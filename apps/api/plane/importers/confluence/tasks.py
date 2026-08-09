# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


def task_item(soup, checked, contents):
    """The editor's checkbox list item, shared with every construct that maps
    onto one."""
    item = soup.new_tag("li")
    item["data-type"] = "taskItem"
    item["data-checked"] = "true" if checked else "false"

    label = soup.new_tag("label")
    checkbox = soup.new_tag("input")
    checkbox["type"] = "checkbox"
    if checked:
        checkbox["checked"] = "checked"
    label.append(checkbox)
    label.append(soup.new_tag("span"))
    item.append(label)

    holder = soup.new_tag("div")
    if contents:
        paragraph = soup.new_tag("p")
        for child in contents:
            paragraph.append(child)
        holder.append(paragraph)
    item.append(holder)
    return item


def task_list(soup, items):
    replacement = soup.new_tag("ul")
    replacement["data-type"] = "taskList"
    for item in items:
        replacement.append(item)
    return replacement


def _build_task_item(soup, task):
    status = task.find("ac:task-status")
    body = task.find("ac:task-body")
    return task_item(
        soup,
        status is not None and status.get_text().strip() == "complete",
        [child.extract() for child in list(body.contents)] if body is not None else [],
    )


def convert_task_lists(soup):
    """ac:task-list becomes a native checkbox list.

    Innermost lists first, so a nested list is already converted by the time
    its parent moves it.
    """
    for node in reversed(soup.find_all("ac:task-list")):
        replacement = task_list(soup, [])

        for child in list(node.children):
            if getattr(child, "name", None) == "ac:task":
                replacement.append(_build_task_item(soup, child))
            elif getattr(child, "name", None) is not None:
                replacement.append(child.extract())

        for identifier in replacement.find_all(["ac:task-id", "ac:task-uuid", "ac:task-status"]):
            identifier.decompose()

        node.replace_with(replacement)
