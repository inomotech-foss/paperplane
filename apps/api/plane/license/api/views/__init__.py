# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .instance import InstanceEndpoint, SignUpScreenVisitedEndpoint


from .configuration import (
    EmailCredentialCheckEndpoint,
    InstanceConfigurationEndpoint,
    DisableEmailFeatureEndpoint,
)


from .admin import (
    InstanceAdminEndpoint,
    InstanceAdminSignInEndpoint,
    InstanceAdminSignUpEndpoint,
    InstanceAdminUserMeEndpoint,
    InstanceAdminSignOutEndpoint,
    InstanceAdminUserSessionEndpoint,
    InstanceAdminOIDCInitiateEndpoint,
    InstanceAdminOIDCCallbackEndpoint,
)


from .workspace import (
    InstanceWorkSpaceAvailabilityCheckEndpoint,
    InstanceWorkSpaceDetailEndpoint,
    InstanceWorkSpaceEndpoint,
    InstanceWorkSpaceTransferOwnerEndpoint,
)
from .oauth_application import InstanceOAuthApplicationEndpoint
from .user import (
    InstanceUserDeactivateEndpoint,
    InstanceUserDetailEndpoint,
    InstanceUserEndpoint,
    InstanceUserMergeEndpoint,
    InstanceUserMergePreviewEndpoint,
    InstanceUserReactivateEndpoint,
)
