# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Seed a project with a small, realistic sales funnel for trying out PQL,
the nested table and dashboards.

    python manage.py seed_sales_funnel --workspace acme --project SALES

The funnel is four nested work item types: Customer > Sales story > Quote >
Invoice. Quotes and invoices carry amounts, invoices have due dates spread
over the last year, so "revenue per month" and "revenue per customer"
widgets show something at once. Types, properties and states are reused
when they already exist; the work items are only created once per project
(`--reset` removes the seeded ones first).
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

from crum import impersonate
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    PropertyTypeChoices,
    State,
    User,
    Workspace,
)
from plane.utils.issue_type import get_or_create_default_issue_type

SEED_SOURCE = "seed_sales_funnel"

CUSTOMER, STORY, QUOTE, INVOICE = "Customer", "Sales story", "Quote", "Invoice"

# Icons are Material Symbols names, which is what the type picker in the web app stores.
TYPES = {
    CUSTOMER: {"icon": "domain", "color": "#3f76ff", "description": "An account we sell to."},
    STORY: {"icon": "handshake", "color": "#8b5cf6", "description": "An opportunity at a customer."},
    QUOTE: {"icon": "request_quote", "color": "#f59e0b", "description": "A priced offer for a sales story."},
    INVOICE: {"icon": "receipt_long", "color": "#16a34a", "description": "A bill issued against a quote."},
}

# name, display name, type, scoped to type, options
PROPERTIES = (
    ("industry", "Industry", PropertyTypeChoices.OPTION, CUSTOMER, ("Manufacturing", "Energy", "Retail", "Software")),
    ("expected_value", "Expected value", PropertyTypeChoices.DECIMAL, STORY, ()),
    ("quote_amount", "Quote amount", PropertyTypeChoices.DECIMAL, QUOTE, ()),
    ("invoice_amount", "Invoice amount", PropertyTypeChoices.DECIMAL, INVOICE, ()),
    ("invoice_number", "Invoice number", PropertyTypeChoices.TEXT, INVOICE, ()),
    ("paid_on", "Paid on", PropertyTypeChoices.DATETIME, INVOICE, ()),
)

# name, group, colour
STATES = (
    ("Sent", "started", "#3f76ff"),
    ("Overdue", "started", "#f59e0b"),
    ("Paid", "completed", "#16a34a"),
    ("Won", "completed", "#16a34a"),
    ("Lost", "cancelled", "#ef4444"),
)


@dataclass
class Invoice:
    name: str
    amount: str
    state: str
    due_in_months: int
    """Months from today; negative is the past."""


@dataclass
class Quote:
    name: str
    amount: str
    state: str
    invoices: list = field(default_factory=list)


@dataclass
class Story:
    name: str
    expected_value: str
    state: str
    quotes: list = field(default_factory=list)


@dataclass
class Customer:
    name: str
    industry: str
    stories: list = field(default_factory=list)


FUNNEL = [
    Customer(
        "Acme GmbH",
        "Manufacturing",
        [
            Story(
                "Acme plant retrofit",
                "120000",
                "Won",
                [
                    Quote(
                        "Acme retrofit phase 1",
                        "48000",
                        "Won",
                        [
                            Invoice("Acme retrofit 1/2", "24000", "Paid", -8),
                            Invoice("Acme retrofit 2/2", "24000", "Paid", -5),
                        ],
                    ),
                    Quote(
                        "Acme retrofit phase 2", "72000", "Sent", [Invoice("Acme phase 2 deposit", "18000", "Sent", 1)]
                    ),
                ],
            ),
            Story(
                "Acme service contract",
                "30000",
                "Won",
                [
                    Quote(
                        "Acme service 2026",
                        "30000",
                        "Won",
                        [
                            Invoice("Acme service Q1", "7500", "Paid", -3),
                            Invoice("Acme service Q2", "7500", "Overdue", -1),
                        ],
                    )
                ],
            ),
        ],
    ),
    Customer(
        "Globex Energy",
        "Energy",
        [
            Story(
                "Globex battery storage",
                "250000",
                "Sent",
                [
                    Quote("Globex storage pilot", "85000", "Won", [Invoice("Globex pilot", "85000", "Paid", -6)]),
                    Quote("Globex storage rollout", "165000", "Sent"),
                ],
            ),
            Story("Globex monitoring", "20000", "Lost", [Quote("Globex monitoring", "20000", "Lost")]),
        ],
    ),
    Customer(
        "Initech Retail",
        "Retail",
        [
            Story(
                "Initech POS upgrade",
                "60000",
                "Won",
                [
                    Quote(
                        "Initech POS for 40 stores",
                        "60000",
                        "Won",
                        [
                            Invoice("Initech POS batch 1", "30000", "Paid", -10),
                            Invoice("Initech POS batch 2", "30000", "Paid", -2),
                        ],
                    )
                ],
            )
        ],
    ),
    Customer(
        "Umbrella Software",
        "Software",
        [Story("Umbrella integration", "15000", "Sent", [Quote("Umbrella integration", "15000", "Sent")])],
    ),
]


def add_months(day, months):
    """`day` shifted by whole months, clamped to the 28th so every month works."""
    month_index = day.month - 1 + months
    return date(day.year + month_index // 12, month_index % 12 + 1, min(day.day, 28))


class Command(BaseCommand):
    help = "Seed a project with a Customer > Sales story > Quote > Invoice funnel for trying out PQL and dashboards"

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True, help="Workspace slug")
        parser.add_argument("--project", required=True, help="Project identifier, e.g. SALES")
        parser.add_argument("--user", help="Email of the member recorded as creator (default: the workspace owner)")
        parser.add_argument("--reset", action="store_true", help="Delete previously seeded work items first")

    def handle(self, *args, **options):
        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug '{options['workspace']}'")
        try:
            project = Project.objects.get(workspace=workspace, identifier__iexact=options["project"])
        except Project.DoesNotExist:
            raise CommandError(f"No project '{options['project']}' in workspace '{workspace.slug}'")
        user = self._creator(workspace, options.get("user"))

        with impersonate(user), transaction.atomic():
            if options["reset"]:
                removed = self._reset(project)
                self.stdout.write(f"Removed {removed} previously seeded work items")
            types = self._types(workspace, project)
            properties = self._properties(workspace, project, types)
            states = self._states(workspace, project)
            seeded = Issue.objects.filter(project=project, external_source=SEED_SOURCE).exists()
            if seeded:
                self.stdout.write(self.style.WARNING("Work items are already seeded; use --reset to recreate them"))
                created = []
            else:
                created = self._work_items(workspace, project, types, properties, states)

        self.stdout.write(self.style.SUCCESS(f"Sales funnel ready in {workspace.slug}/{project.identifier}"))
        for issue, kind in created:
            self.stdout.write(f"  {project.identifier}-{issue.sequence_id:<5} {kind:<12} {issue.name}")
        if created:
            customer = next(issue for issue, kind in created if kind == CUSTOMER)
            self.stdout.write("")
            self.stdout.write("Try in the query bar:")
            self.stdout.write(f'  descendantOf("{project.identifier}-{customer.sequence_id}")')
            self.stdout.write('  type = "Invoice" AND state = "Paid" AND cf["Invoice amount"] > 10000')

    # -- lookups -----------------------------------------------------------

    def _creator(self, workspace, email):
        if email:
            try:
                return User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                raise CommandError(f"No user with email '{email}'")
        if workspace.owner_id is None:
            raise CommandError("The workspace has no owner; pass --user")
        return workspace.owner

    def _types(self, workspace, project):
        get_or_create_default_issue_type(project)
        if not project.is_issue_type_enabled:
            project.is_issue_type_enabled = True
            project.save(update_fields=["is_issue_type_enabled"])
        types = {}
        for name, spec in TYPES.items():
            issue_type, _ = IssueType.objects.get_or_create(
                workspace=workspace,
                name=name,
                defaults={
                    "description": spec["description"],
                    "logo_props": {"in_use": "icon", "icon": {"name": spec["icon"], "color": spec["color"]}},
                    "is_active": True,
                },
            )
            ProjectIssueType.objects.get_or_create(
                project=project, issue_type=issue_type, defaults={"workspace": workspace}
            )
            types[name] = issue_type
        return types

    def _properties(self, workspace, project, types):
        properties = {}
        for name, display_name, property_type, type_name, options in PROPERTIES:
            prop, _ = IssueProperty.objects.get_or_create(
                project=project,
                name=name,
                defaults={
                    "workspace": workspace,
                    "display_name": display_name,
                    "property_type": property_type,
                    "issue_type": types[type_name],
                },
            )
            for position, option in enumerate(options):
                IssuePropertyOption.objects.get_or_create(
                    property=prop,
                    name=option,
                    defaults={"project": project, "workspace": workspace, "sort_order": (position + 1) * 10000},
                )
            properties[name] = prop
        return properties

    def _states(self, workspace, project):
        states = {}
        top = State.objects.filter(project=project).order_by("-sequence").values_list("sequence", flat=True).first()
        sequence = (top or 0) + 5000
        for name, group, color in STATES:
            state, created = State.objects.get_or_create(
                project=project, name=name, defaults={"workspace": workspace, "group": group, "color": color}
            )
            if created:
                state.sequence = sequence
                state.save(update_fields=["sequence"])
                sequence += 5000
            states[name] = state
        default = (
            State.objects.filter(project=project, default=True).first() or State.objects.filter(project=project).first()
        )
        if default is None:
            raise CommandError("The project has no states; open it once in the app first")
        states["default"] = default
        states["active"] = (
            State.objects.filter(project=project, group="started").exclude(name="Overdue").first() or default
        )
        return states

    # -- data --------------------------------------------------------------

    def _reset(self, project):
        seeded = Issue.objects.filter(project=project, external_source=SEED_SOURCE)
        count = seeded.count()
        # deepest first, so no child outlives its parent
        for issue in sorted(seeded, key=lambda item: item.external_id or "", reverse=True):
            issue.delete()
        return count

    def _work_items(self, workspace, project, types, properties, states):
        created = []
        today = timezone.now().date()
        counter = {"n": 0}

        def item(name, kind, state, parent=None, **fields):
            counter["n"] += 1
            issue = Issue.objects.create(
                workspace=workspace,
                project=project,
                name=name,
                type=types[kind],
                state=state,
                parent=parent,
                external_source=SEED_SOURCE,
                external_id=f"{counter['n']:03d}",
                **fields,
            )
            created.append((issue, kind))
            return issue

        def value(issue, name, **fields):
            IssuePropertyValue.objects.create(
                workspace=workspace, project=project, issue=issue, property=properties[name], **fields
            )

        invoice_number = 0
        for customer_spec in FUNNEL:
            customer = item(customer_spec.name, CUSTOMER, states["active"])
            option = IssuePropertyOption.objects.get(property=properties["industry"], name=customer_spec.industry)
            value(customer, "industry", value_option=option)
            for story_spec in customer_spec.stories:
                story = item(story_spec.name, STORY, states[story_spec.state], parent=customer)
                value(story, "expected_value", value_number=Decimal(story_spec.expected_value))
                for quote_spec in story_spec.quotes:
                    quote = item(quote_spec.name, QUOTE, states[quote_spec.state], parent=story)
                    value(quote, "quote_amount", value_number=Decimal(quote_spec.amount))
                    for invoice_spec in quote_spec.invoices:
                        invoice_number += 1
                        due = add_months(today, invoice_spec.due_in_months)
                        invoice = item(
                            invoice_spec.name, INVOICE, states[invoice_spec.state], parent=quote, target_date=due
                        )
                        value(invoice, "invoice_amount", value_number=Decimal(invoice_spec.amount))
                        value(invoice, "invoice_number", value_text=f"INV-{today.year}-{invoice_number:03d}")
                        if invoice_spec.state == "Paid":
                            paid_on = datetime.combine(due - timedelta(days=4), time(12), tzinfo=dt_timezone.utc)
                            value(invoice, "paid_on", value_date=paid_on)
        return created
