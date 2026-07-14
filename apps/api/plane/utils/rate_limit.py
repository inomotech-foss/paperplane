# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os

# Django imports
from django.core.cache import cache

# Module imports
from plane.license.utils.instance_value import get_configuration_value

# Throttle scope -> instance-config key. The scope is what DRF looks up; the key
# is the god-mode configuration that overrides it.
THROTTLE_RATE_KEYS = {
    "api_key": "API_KEY_RATE_LIMIT",
    "anon": "ANON_RATE_LIMIT",
    "asset_id": "ASSET_RATE_LIMIT",
    "authentication": "AUTHENTICATION_RATE_LIMIT",
}

# Baked defaults, also used as the env fallback when a config value is missing
# or malformed.
DEFAULT_THROTTLE_RATES = {
    "API_KEY_RATE_LIMIT": "60/minute",
    "ANON_RATE_LIMIT": "30/minute",
    "ASSET_RATE_LIMIT": "5/minute",
    "AUTHENTICATION_RATE_LIMIT": "10/minute",
}

# Cached for the whole process; invalidated on config save (invalidate_throttle_rates).
_CACHE_KEY = "instance_throttle_rates"

_VALID_PERIODS = frozenset({"s", "m", "h", "d"})


def is_valid_rate(rate):
    """A DRF rate string is "<num>/<period>", period starting with s/m/h/d."""
    if not rate:
        return False
    try:
        num, period = str(rate).split("/")
        int(num)
    except ValueError:
        return False
    return bool(period) and period[0] in _VALID_PERIODS


def _load_rates():
    keys = [{"key": key, "default": os.environ.get(key, default)} for key, default in DEFAULT_THROTTLE_RATES.items()]
    values = get_configuration_value(keys)
    return dict(zip(DEFAULT_THROTTLE_RATES.keys(), values))


def get_throttle_rate(scope):
    """Resolve a throttle rate from instance config, falling back to the env
    value and then the baked default. Always returns a valid DRF rate string so
    SimpleRateThrottle.parse_rate never raises on the request path."""
    config_key = THROTTLE_RATE_KEYS[scope]
    rates = cache.get(_CACHE_KEY)
    if rates is None:
        rates = _load_rates()
        cache.set(_CACHE_KEY, rates, None)
    value = rates.get(config_key)
    if is_valid_rate(value):
        return value
    fallback = os.environ.get(config_key, DEFAULT_THROTTLE_RATES[config_key])
    return fallback if is_valid_rate(fallback) else DEFAULT_THROTTLE_RATES[config_key]


def invalidate_throttle_rates():
    cache.delete(_CACHE_KEY)
