# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from dataclasses import dataclass

import openai
from openai import OpenAI

from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception


@dataclass(frozen=True)
class LLMProvider:
    name: str
    # Used when LLM_MODEL is empty. Any model name the provider accepts works.
    default_model: str
    # The provider's OpenAI-compatible endpoint. None means OpenAI itself.
    base_url: str | None = None
    # Anthropic requires an output limit, the others default to the model maximum.
    max_tokens: int | None = None


SUPPORTED_PROVIDERS = {
    "openai": LLMProvider(
        name="OpenAI",
        default_model="gpt-5.4-mini",
    ),
    "anthropic": LLMProvider(
        name="Anthropic",
        default_model="claude-haiku-4-5",
        base_url="https://api.anthropic.com/v1/",
        max_tokens=8192,
    ),
    "gemini": LLMProvider(
        name="Gemini",
        default_model="gemini-3.8-flash",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    ),
}


@dataclass(frozen=True)
class LLMConfig:
    provider_key: str
    provider: LLMProvider
    api_key: str
    model: str


class LLMError(Exception):
    """A completion failed. `code` and the message are safe to show to users."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _configured_values(decrypt=True):
    return get_configuration_value(
        [
            {"key": "LLM_API_KEY", "default": os.environ.get("LLM_API_KEY", None)},
            {"key": "LLM_PROVIDER", "default": os.environ.get("LLM_PROVIDER", "openai")},
            {"key": "LLM_MODEL", "default": os.environ.get("LLM_MODEL", None)},
        ],
        decrypt=decrypt,
    )


def get_llm_config() -> LLMConfig | None:
    """The configured provider, key and model, or None when the instance has no usable LLM."""
    api_key, provider_key, model = _configured_values()
    if not api_key:
        return None
    provider_key = (provider_key or "openai").lower()
    provider = SUPPORTED_PROVIDERS.get(provider_key)
    if not provider:
        log_exception(ValueError(f"Unsupported LLM provider: {provider_key}"))
        return None
    return LLMConfig(provider_key, provider, api_key, model or provider.default_model)


def is_llm_configured() -> bool:
    api_key, provider_key, _ = _configured_values(decrypt=False)
    return bool(api_key) and (provider_key or "openai").lower() in SUPPORTED_PROVIDERS


def complete(config: LLMConfig, messages: list[dict[str, str]]) -> str:
    """Run a chat completion and return the reply text. Raises LLMError."""
    client = OpenAI(api_key=config.api_key, base_url=config.provider.base_url, timeout=60, max_retries=0)
    options = {"max_tokens": config.provider.max_tokens} if config.provider.max_tokens else {}
    name = config.provider.name
    try:
        completion = client.chat.completions.create(model=config.model, messages=messages, **options)
    except openai.AuthenticationError as e:
        log_exception(e)
        raise LLMError("provider_auth", f"{name} rejected the configured API key") from e
    except openai.RateLimitError as e:
        log_exception(e)
        raise LLMError("provider_rate_limit", f"{name} rate limit exceeded, try again later") from e
    except openai.NotFoundError as e:
        log_exception(e)
        raise LLMError("provider_model", f"{name} does not know the model {config.model}") from e
    except openai.OpenAIError as e:
        log_exception(e)
        raise LLMError("provider_error", f"{name} could not generate a response") from e

    text = completion.choices[0].message.content if completion.choices else None
    if not text or not text.strip():
        raise LLMError("empty_response", f"{name} returned an empty response")
    return text
