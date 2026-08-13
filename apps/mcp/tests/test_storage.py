"""The startup PING waits for the Redis Service instead of exiting on a race."""

import sys
import types

import pytest

from plane_mcp import storage


@pytest.fixture
def fake_redis(monkeypatch):
    """Install a stub redis module whose ping fails a set number of times first."""
    calls = []

    def install(failures):
        class FakeClient:
            def __init__(self, **kwargs):
                pass

            def ping(self):
                calls.append(1)
                if len(calls) <= failures:
                    raise OSError("Name or service not known")

            def close(self):
                pass

        module = types.ModuleType("redis")
        module.Redis = FakeClient
        monkeypatch.setitem(sys.modules, "redis", module)
        return calls

    monkeypatch.setattr(storage.time, "sleep", lambda _: None)
    return install


def test_ping_retries_until_redis_answers(fake_redis):
    calls = fake_redis(failures=2)
    storage._ping_redis("redis", 6379)
    assert len(calls) == 3


def test_ping_gives_up_at_the_deadline(fake_redis):
    fake_redis(failures=1)
    with pytest.raises(RuntimeError, match="startup PING"):
        storage._ping_redis("redis", 6379, retry_seconds=0)
