# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


def _build_task_item(soup, task):
    status = task.find("ac:task-status")
    checked = status is not None and status.get_text().strip() == "complete"

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

    body = task.find("ac:task-body")
    content = soup.new_tag("div")
    if body is not None:
        paragraph = soup.new_tag("p")
        for child in list(body.contents):
            paragraph.append(child.extract())
        content.append(paragraph)
    item.append(content)
    return item


def convert_task_lists(soup):
    """ac:task-list becomes a native checkbox list.

    Innermost lists first, so a nested list is already converted by the time
    its parent moves it.
    """
    for task_list in reversed(soup.find_all("ac:task-list")):
        replacement = soup.new_tag("ul")
        replacement["data-type"] = "taskList"

        for child in list(task_list.children):
            if getattr(child, "name", None) == "ac:task":
                replacement.append(_build_task_item(soup, child))
            elif getattr(child, "name", None) is not None:
                replacement.append(child.extract())

        for identifier in replacement.find_all(["ac:task-id", "ac:task-uuid", "ac:task-status"]):
            identifier.decompose()

        task_list.replace_with(replacement)
