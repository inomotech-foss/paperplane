# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


def macro_parameters(node):
    # The anchor macro stores its name in the unnamed parameter, so an empty
    # ac:name is meaningful and kept under "".
    return {
        parameter.get("ac:name", ""): parameter.get_text().strip()
        for parameter in node.find_all("ac:parameter", recursive=False)
    }


def macro_parameter(node, name):
    for parameter in node.find_all("ac:parameter", recursive=False):
        if parameter.get("ac:name", "") == name:
            return parameter
    return None
