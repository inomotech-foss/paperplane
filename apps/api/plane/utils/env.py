# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

FILE_ENV_SUFFIX = "_FILE"


def load_file_env(environ=None):
    """Expand `<NAME>_FILE` environment variables from the files they point to.

    For each `<NAME>_FILE` variable, read the referenced file and set `<NAME>`
    to its contents (surrounding whitespace trimmed). An already-set `<NAME>`
    wins and the file is skipped. This lets secrets be mounted as files (for
    example by the Secrets Store CSI driver or a Secret volume) and read
    directly, instead of being passed as literal environment values.
    """
    environ = os.environ if environ is None else environ

    file_keys = [key for key in list(environ) if key.endswith(FILE_ENV_SUFFIX) and key != FILE_ENV_SUFFIX]
    for key in file_keys:
        target = key[: -len(FILE_ENV_SUFFIX)]
        path = environ[key]
        if not path or environ.get(target):
            continue
        try:
            with open(path, encoding="utf-8") as handle:
                environ[target] = handle.read().strip()
        except OSError as exc:
            raise RuntimeError(f"Could not read secret file for {target} from {path}: {exc}") from exc
