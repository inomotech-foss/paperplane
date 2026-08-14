# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from urllib.parse import quote

from bs4 import BeautifulSoup, NavigableString

from .parameters import macro_parameters

# Jira issue keys: a project key (letters, digits, underscores, starting with a
# letter) followed by a dash and a number. Case-insensitive so ABC-1 and abc-1
# both match, but the key is always emitted exactly as written.
_KEY_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]*-[0-9]+", re.IGNORECASE)

# The common enumerated-key form of a JQL query, e.g. "key in (ABC-1, ABC-2)".
_KEY_IN_RE = re.compile(r"key\s+in\s*\((?P<keys>[^)]*)\)", re.IGNORECASE)


def _macro_keys(node):
    parameters = macro_parameters(node)
    key = parameters.get("key", "").strip()
    if key:
        return [key]
    enumeration = _KEY_IN_RE.search(parameters.get("jqlQuery", ""))
    return _KEY_RE.findall(enumeration.group("keys")) if enumeration else []


def derive_base_urls(pages, site, project_keys):
    """Work out which Confluence Jira servers are the backed-up site.

    A macro naming a backed-up project can only point at that site, and a
    serverId names one site, so one match resolves the whole server.
    """
    if not site or not project_keys:
        return {}

    base_urls = {}
    for page in pages:
        body = page.body or ""
        if 'ac:name="jira"' not in body:
            continue
        for node in BeautifulSoup(body, "html.parser").find_all("ac:structured-macro", attrs={"ac:name": "jira"}):
            server_id = macro_parameters(node).get("serverId", "").strip()
            if not server_id or server_id in base_urls:
                continue
            if any(key.rsplit("-", 1)[0].upper() in project_keys for key in _macro_keys(node)):
                base_urls[server_id] = site
    return base_urls


def _issue_link(soup, base, key):
    if base is None:
        return NavigableString(key)
    tag = soup.new_tag("a")
    tag["href"] = f"{base}/browse/{key}"
    tag.string = key
    return tag


def _split_key(key):
    """`DEMO-12` -> ("DEMO", 12), the project identifier and sequence id an
    imported work item is looked up by."""
    project_key, _, number = key.rpartition("-")
    try:
        return project_key, int(number)
    except ValueError:
        return None, None


def _issue_embed(soup, issue):
    tag = soup.new_tag("issue-embed-component")
    tag["id"] = issue.id
    tag["entity_identifier"] = issue.id
    tag["entity_name"] = "issue_embed"
    tag["project_identifier"] = issue.project_id
    tag["workspace_identifier"] = issue.workspace_id
    return tag


def _search_link(soup, base, jql):
    if base is None:
        return NavigableString(jql)
    tag = soup.new_tag("a")
    tag["href"] = f"{base}/issues/?jql={quote(jql)}"
    tag.string = jql
    return tag


def convert_jira_macro(soup, node, resolvers, result):
    """A key naming an imported work item becomes a real embed; anything else
    falls back to a live link, a lesser but faithful representation and so
    always a downgrade, never a loss."""
    parameters = macro_parameters(node)
    base = resolvers.jira_base_url(parameters.get("serverId", ""))

    key = parameters.get("key", "").strip()
    if key:
        project_key, sequence_id = _split_key(key)
        issue = resolvers.jira_issue(project_key, sequence_id)
        if issue is not None:
            node.replace_with(_issue_embed(soup, issue))
            return
        result.downgraded["jira"] += 1
        node.replace_with(_issue_link(soup, base, key))
        return

    jql = parameters.get("jqlQuery", "").strip()
    if jql:
        result.downgraded["jira"] += 1
        enumeration = _KEY_IN_RE.search(jql)
        fragments = []
        if enumeration:
            for enumerated_key in _KEY_RE.findall(enumeration.group("keys")):
                if fragments:
                    fragments.append(NavigableString(", "))
                fragments.append(_issue_link(soup, base, enumerated_key))
        if not fragments:
            fragments = [_search_link(soup, base, jql)]
        node.replace_with(*fragments)
        return

    result.unsupported_macros["jira"] += 1
    node.decompose()
