# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.utils.env import load_file_env


@pytest.mark.unit
class TestLoadFileEnv:
    def test_reads_file_into_target(self, tmp_path):
        secret = tmp_path / "client-secret"
        secret.write_text("s3cr3t\n")
        env = {"OIDC_CLIENT_SECRET_FILE": str(secret)}

        load_file_env(env)

        assert env["OIDC_CLIENT_SECRET"] == "s3cr3t"

    def test_both_set_raises(self, tmp_path):
        secret = tmp_path / "client-secret"
        secret.write_text("from-file")
        env = {"OIDC_CLIENT_SECRET_FILE": str(secret), "OIDC_CLIENT_SECRET": "from-env"}

        with pytest.raises(RuntimeError):
            load_file_env(env)

    def test_empty_path_is_skipped(self):
        env = {"OIDC_CLIENT_SECRET_FILE": ""}

        load_file_env(env)

        assert "OIDC_CLIENT_SECRET" not in env

    def test_non_file_vars_untouched(self):
        env = {"OIDC_ISSUER": "https://issuer.example.com"}

        load_file_env(env)

        assert env == {"OIDC_ISSUER": "https://issuer.example.com"}

    def test_missing_file_raises(self, tmp_path):
        env = {"OIDC_CLIENT_SECRET_FILE": str(tmp_path / "does-not-exist")}

        with pytest.raises(RuntimeError):
            load_file_env(env)
