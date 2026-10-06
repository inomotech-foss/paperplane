// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useSyncExternalStore } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkOutline, NewTabOutline } from "@makeplane/propel/icons";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { useProjectLink } from "@/hooks/store/use-project-link";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { resolveProjectLink } from "@/store/project/project-link-url";

type TProjectSidebarLinksProps = {
  workspaceSlug: string;
  projectId: string;
  onInternalClick: () => void;
};

const stripTrailingSlash = (path: string) => path.replace(/\/+$/, "");

// The origin never changes while the app is loaded.
const subscribeToNothing = () => () => {};
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export const ProjectSidebarLinks = observer(function ProjectSidebarLinks(props: TProjectSidebarLinksProps) {
  const { workspaceSlug, projectId, onInternalClick } = props;
  const pathname = usePathname();
  const { getLinksByProjectId } = useProjectLink();
  const { workspaces } = useWorkspace();
  const links = getLinksByProjectId(workspaceSlug, projectId);
  const workspaceSlugs = new Set(Object.values(workspaces).map((workspace) => workspace.slug));
  const origin = useSyncExternalStore(subscribeToNothing, getClientOrigin, getServerOrigin);

  if (!origin) return null;

  return (
    <>
      {links.map((link) => {
        const resolved = resolveProjectLink(link.url, origin, workspaceSlugs);
        if (!resolved) return null;

        const content = (
          <div className="flex w-full items-center justify-between gap-1.5 py-[1px]">
            <div className="flex min-w-0 items-center gap-1.5">
              <LinkOutline className="size-4 flex-shrink-0 stroke-[1.5]" />
              <span className="truncate text-11 font-medium">{link.title}</span>
            </div>
            {resolved.kind === "external" && <NewTabOutline className="size-3 flex-shrink-0 text-tertiary" />}
          </div>
        );

        if (resolved.kind === "external")
          return (
            <a key={link.id} href={resolved.href} target="_blank" rel="noopener noreferrer">
              <SidebarNavItem>{content}</SidebarNavItem>
            </a>
          );

        const isActive = stripTrailingSlash(pathname) === stripTrailingSlash(new URL(resolved.href, origin).pathname);
        return (
          <Link key={link.id} href={resolved.href} onClick={onInternalClick}>
            <SidebarNavItem isActive={isActive}>{content}</SidebarNavItem>
          </Link>
        );
      })}
    </>
  );
});
