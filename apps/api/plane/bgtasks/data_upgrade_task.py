# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

from celery import shared_task

from plane.maintenance.runner import Outcome, run_pending

TIME_BUDGET = timedelta(minutes=4)


@shared_task
def run_data_upgrades() -> str:
    outcome = run_pending(TIME_BUDGET)
    if outcome is Outcome.MORE:
        run_data_upgrades.delay()
    return outcome.value
