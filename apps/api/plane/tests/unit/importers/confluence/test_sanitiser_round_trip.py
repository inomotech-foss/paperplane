# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from urllib.parse import quote

import pytest

from plane.importers.confluence import ResolvedAttachment, ResolvedPage, Resolvers, storage_to_html
from plane.utils.content_validator import _compute_html_sanitization_diff, validate_html_content

_ROADMAP_SOURCE = quote(
    json.dumps(
        {
            "title": "Roadmap",
            "timeline": {
                "startDate": "2024-01-01 00:00:00",
                "endDate": "2024-06-01 00:00:00",
                "displayOption": "MONTH",
            },
            "lanes": [
                {
                    "title": "Phase one",
                    "color": {},
                    "bars": [
                        {
                            "title": "Discovery",
                            "description": "",
                            "startDate": "2024-01-01 00:00:00",
                            "duration": 2,
                            "rowIndex": 0,
                            "id": "bar-1",
                            "pageLink": {},
                        }
                    ],
                }
            ],
            "markers": [{"title": "Milestone A", "markerDate": "2024-03-01 00:00:00"}],
        }
    )
)

SUPPORTED_CONSTRUCTS = f"""
<h1>Heading</h1>
<p>Prose with <strong>bold</strong> and <em>italic</em>.</p>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">python</ac:parameter>
  <ac:plain-text-body>x = 1</ac:plain-text-body></ac:structured-macro>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>heads up</p></ac:rich-text-body></ac:structured-macro>
<ac:task-list><ac:task><ac:task-status>complete</ac:task-status>
  <ac:task-body>done</ac:task-body></ac:task></ac:task-list>
<table data-layout="wide"><colgroup><col style="width: 120.0px;"/></colgroup>
  <tbody><tr><th data-highlight-colour="#fffae6"><p>H</p></th></tr></tbody></table>
<p><ac:emoticon ac:emoji-fallback="✅"/> <time datetime="2024-01-01"/></p>
<p><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">approved</ac:parameter></ac:structured-macro></p>
<ul><li><p>list item</p></li></ul>
<blockquote><p>quote</p></blockquote>
<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">section-1</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="toc"><ac:parameter ac:name="minLevel">2</ac:parameter>
  <ac:parameter ac:name="maxLevel">5</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="children"><ac:parameter ac:name="depth">10</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="attachments"/>
<ac:adf-extension><ac:adf-node type="decision-list">
  <ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute>
    <ac:adf-content>decided</ac:adf-content></ac:adf-node></ac:adf-node></ac:adf-extension>
<ac:structured-macro ac:name="drawio"><ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter>
  <ac:parameter ac:name="diagramDisplayName">Release Flow.drawio</ac:parameter>
  <ac:parameter ac:name="width">1872</ac:parameter>
  <ac:parameter ac:name="height">982</ac:parameter></ac:structured-macro>
<ac:image ac:align="center" ac:width="400"><ri:attachment ri:filename="diagram.png"/></ac:image>
<ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">
  <ri:attachment ri:filename="spec.pdf"/></ac:parameter></ac:structured-macro>
<p><ac:structured-macro ac:name="eazy-math-inline">
  <ac:parameter ac:name="body">a_{0}=\frac{1}{2}</ac:parameter></ac:structured-macro></p>
<ac:structured-macro ac:name="miro-macro">
  <ac:parameter ac:name="accessLink">https://miro.com/app/board/abc/</ac:parameter></ac:structured-macro>
<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell><p>left</p></ac:layout-cell>
  <ac:layout-cell><p>right</p></ac:layout-cell></ac:layout-section></ac:layout>
<ac:structured-macro ac:name="jira"><ac:parameter ac:name="serverId">server-1</ac:parameter>
  <ac:parameter ac:name="key">ABC-123</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="roadmap"><ac:parameter ac:name="title">Roadmap</ac:parameter>
  <ac:parameter ac:name="source">{_ROADMAP_SOURCE}</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="portfolioforjiraplan">
  <ac:parameter ac:name="url">https://example.com/plan</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="stepashka-simple-plantuml-macro">
  <ac:parameter ac:name="diagram">@startuml
A -> B
@enduml</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="pagetree"><ac:parameter ac:name="startDepth">3</ac:parameter>
  <ac:parameter ac:name="searchBox">true</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="index"/>
<ac:structured-macro ac:name="children"><ac:parameter ac:name="page">
  <ac:link><ri:page ri:content-title="Rooted"/></ac:link></ac:parameter>
  <ac:parameter ac:name="all">true</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="recently-updated"><ac:parameter ac:name="max">15</ac:parameter>
  <ac:parameter ac:name="spaces">OTHER</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="contributors"><ac:parameter ac:name="scope">descendants</ac:parameter>
  <ac:parameter ac:name="limit">10</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="livesearch"><ac:parameter ac:name="placeholder">Find a page</ac:parameter>
  <ac:parameter ac:name="spaceKey">OTHER</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="pagetreesearch"><ac:parameter ac:name="rootPage">Rooted</ac:parameter>
  </ac:structured-macro>
<ac:structured-macro ac:name="contentbylabel"><ac:parameter ac:name="labels">runbook,process</ac:parameter>
  <ac:parameter ac:name="max">20</ac:parameter><ac:parameter ac:name="sort">modified</ac:parameter>
  <ac:parameter ac:name="reverse">true</ac:parameter>
  <ac:parameter ac:name="spaces">OTHER</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="listlabels"><ac:parameter ac:name="spaceKey">OTHER</ac:parameter>
  </ac:structured-macro>
<ac:structured-macro ac:name="detailssummary"><ac:parameter ac:name="label">runbook</ac:parameter>
  <ac:parameter ac:name="headings">Owner,Status</ac:parameter>
  <ac:parameter ac:name="sortBy">title</ac:parameter>
  <ac:parameter ac:name="pageSize">25</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="content-report-table"><ac:parameter ac:name="labels">process</ac:parameter>
  <ac:parameter ac:name="maxResults">30</ac:parameter>
  <ac:parameter ac:name="sort">page created</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="tasks-report-macro"><ac:parameter ac:name="status">incomplete</ac:parameter>
  <ac:parameter ac:name="pageSize">40</ac:parameter>
  <ac:parameter ac:name="columns">description,duedate,assignee</ac:parameter>
  <ac:parameter ac:name="labels">runbook</ac:parameter></ac:structured-macro>
<ac:structured-macro ac:name="decisionreport"><ac:parameter ac:name="cql">label = "runbook"</ac:parameter>
  <ac:parameter ac:name="max">10</ac:parameter>
  <ac:parameter ac:name="sort">page created</ac:parameter></ac:structured-macro>
<issue-embed-component id="77777777-7777-4777-8777-777777777777"
  entity_identifier="88888888-8888-4888-8888-888888888888" entity_name="issue"
  project_identifier="99999999-9999-4999-8999-999999999999"
  workspace_identifier="sample-workspace"></issue-embed-component>
<p><img src="/wiki/s/1/2/_/images/icons/emoticons/star_blue.png" alt="(blue star)" width="16" height="16"/></p>
<p><a href="https://example.com" data-card-appearance="inline">smart link</a></p>
"""

IMAGE_ID = "22222222-2222-4222-8222-222222222222"
PDF_ID = "33333333-3333-4333-8333-333333333333"
DIAGRAM_ID = "44444444-4444-4444-8444-444444444444"
DIAGRAM_PNG_ID = "55555555-5555-4555-8555-555555555555"

RESOLVERS = Resolvers(
    attachments={
        "diagram.png": ResolvedAttachment(id=IMAGE_ID, filename="diagram.png", is_image=True),
        "spec.pdf": ResolvedAttachment(id=PDF_ID, filename="spec.pdf", is_image=False, url="/assets/spec.pdf"),
        "Flow.drawio": ResolvedAttachment(id=DIAGRAM_ID, filename="Flow.drawio", is_image=False),
        "Flow.drawio.png": ResolvedAttachment(id=DIAGRAM_PNG_ID, filename="Flow.drawio.png", is_image=True),
    },
    jira_base_urls={"server-1": "https://example.atlassian.net"},
    pages={"Rooted": ResolvedPage(id="66666666-6666-4666-8666-666666666666", url="/p/1/", title="Rooted")},
)


@pytest.mark.unit
class TestConverterOutputSurvivesTheSanitiser:
    """Converter output is written through validate_html_content, so anything
    it strips is lost before the page is ever opened."""

    def test_nothing_the_converter_emits_is_stripped(self):
        html = storage_to_html(SUPPORTED_CONSTRUCTS, RESOLVERS).html

        is_valid, error, clean = validate_html_content(html)

        assert is_valid, error
        diff = _compute_html_sanitization_diff(html, clean)
        assert diff["removed_tags"] == {}
        assert diff["removed_attributes"] == {}
