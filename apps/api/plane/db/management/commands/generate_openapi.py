# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import contextlib
import logging
from pathlib import Path

from django.conf import settings
from django.core.management import BaseCommand, CommandError
from drf_spectacular.drainage import GENERATOR_STATS
from drf_spectacular.renderers import OpenApiYamlRenderer
from drf_spectacular.settings import patched_settings, spectacular_settings
from drf_spectacular.validation import validate_schema

# Registers the authentication extensions.
import plane.utils.openapi  # noqa: F401
from plane.utils.openapi.surfaces import SURFACES

DEFAULT_OUTPUT_DIR = Path(settings.BASE_DIR).parent / "openapi"


@contextlib.contextmanager
def _quiet():
    # Views that fail without a request log through plane.exception.
    logging.disable(logging.CRITICAL)
    try:
        with GENERATOR_STATS.silence():
            yield
    finally:
        logging.disable(logging.NOTSET)


def generate_schema(surface, verbose=False):
    """Return the schema of one surface and its unique generator warnings."""
    GENERATOR_STATS.reset()
    quiet = contextlib.nullcontext() if verbose else _quiet()
    with patched_settings(SURFACES[surface]), quiet:
        schema = spectacular_settings.DEFAULT_GENERATOR_CLASS().get_schema(request=None, public=True)
    warnings = [*GENERATOR_STATS._warn_cache, *GENERATOR_STATS._error_cache]
    GENERATOR_STATS.reset()
    return schema, warnings


def render_schema(schema):
    return OpenApiYamlRenderer().render(schema, renderer_context={})


class Command(BaseCommand):
    help = "Write the OpenAPI schema of each API surface to apps/api/openapi/<surface>.yaml"

    def add_arguments(self, parser):
        parser.add_argument("surfaces", nargs="*", help=f"Surfaces to write (default: {', '.join(SURFACES)})")
        parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)

    def handle(self, *args, **options):
        surfaces = options["surfaces"] or list(SURFACES)
        unknown = sorted(set(surfaces) - set(SURFACES))
        if unknown:
            raise CommandError(f"Unknown surface: {', '.join(unknown)}")

        output_dir = options["output_dir"]
        output_dir.mkdir(parents=True, exist_ok=True)
        for surface in surfaces:
            schema, warnings = generate_schema(surface, verbose=options["verbosity"] > 1)
            try:
                validate_schema(schema)
            except Exception as e:
                raise CommandError(f"{surface}: invalid schema: {e}") from e

            path = output_dir / f"{surface}.yaml"
            path.write_bytes(render_schema(schema))
            operations = sum(len(item) for item in schema["paths"].values())
            self.stdout.write(f"{surface}: {operations} operations, {len(warnings)} warnings -> {path}")
