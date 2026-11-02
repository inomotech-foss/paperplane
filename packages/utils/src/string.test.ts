/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { sanitizeCommentForNotification } from "./notification";
import { isCommentEmpty, isEmptyHtmlString, isStringCommentEmpty, sanitizeHTML, stripAndTruncateHTML } from "./string";

describe("sanitizeHTML", () => {
  it.each([
    ["", ""],
    ["plain text", "plain text"],
    ["<p>Some text</p>", "Some text"],
    ["  <p>  padded  </p>  ", "padded"],
    ["<p>a</p><p>b</p>", "ab"],
    ["<p>Hello <strong>bold</strong> <em>world</em></p>", "Hello bold world"],
    ["<ul><li>one</li><li>two</li></ul>", "onetwo"],
    ["<p>line<br>break</p>", "linebreak"],
    ["<img src=x onerror=alert(1)>caption", "caption"],
    ['<a href="javascript:alert(1)">link</a>', "link"],
    ["<p>a<script>alert(1)</script>b</p>", "ab"],
    ["<style>p { color: red; }</style>text", "text"],
    ["<textarea>hidden</textarea>shown", "shown"],
    ["<select><option>hidden</option></select>shown", "shown"],
    ["<xmp><b>hidden</b></xmp>shown", "shown"],
    ["<iframe><p>inner</p></iframe>", "inner"],
    ["<!-- comment -->text", "text"],
    ["<p>Tom &amp; Jerry</p>", "Tom &amp; Jerry"],
    ["<p>1 &lt; 2 &gt; 0</p>", "1 &lt; 2 &gt; 0"],
    ["<p>&quot;quoted&quot; &#39;single&#39;</p>", "\"quoted\" 'single'"],
    ["<p>&nbsp;</p>", ""],
    ["<p>caf&eacute; &#x1F600;</p>", "café \u{1F600}"],
    ["unclosed <b>bold", "unclosed bold"],
    ["a < b", "a &lt; b"],
    ['<mention-component label="Alice"></mention-component> hi', "hi"],
    ['{"in_use":"emoji","emoji":{"value":"128512"}}', '{"in_use":"emoji","emoji":{"value":"128512"}}'],
    ["#ff0000", "#ff0000"],
  ])("strips %j to %j", (input, expected) => {
    expect(sanitizeHTML(input)).toBe(expected);
  });
});

describe("stripAndTruncateHTML", () => {
  it("strips tags before truncating", () => {
    expect(stripAndTruncateHTML("<p>This is a long text</p>", 7)).toBe("This is...");
  });

  it("uses a default length of 55", () => {
    const text = "x".repeat(60);
    expect(stripAndTruncateHTML(`<p>${text}</p>`)).toBe(`${"x".repeat(55)}...`);
  });
});

describe("sanitizeCommentForNotification", () => {
  it("replaces mentions with their label", () => {
    expect(
      sanitizeCommentForNotification(
        '<p>Hi <mention-component id="1" label="Alice" entity_name="user_mention"></mention-component>!</p>'
      )
    ).toBe("Hi Alice!");
  });

  it("passes undefined through", () => {
    expect(sanitizeCommentForNotification(undefined)).toBeUndefined();
  });
});

describe("isEmptyHtmlString", () => {
  it.each([
    ["", true],
    ["<p></p>", true],
    ["<p>   </p><p><br></p>", true],
    ["<p>&nbsp;</p>", true],
    ["<p><script>text</script></p>", true],
    ["<p>text</p>", false],
    ["<p><img src='a.png'></p>", true],
  ])("treats %j as empty: %s", (input, expected) => {
    expect(isEmptyHtmlString(input)).toBe(expected);
  });

  it.each([
    ["<p><img src='a.png'></p>", true, false],
    ["<p><IMG src='a.png'></p>", true, false],
    ["<p><image-component src='a'></image-component></p>", true, true],
    ["<option><img src='a.png'></option>", true, true],
    ["<iframe><img src='a.png'></iframe>", true, false],
  ])("treats %j with img allowed (%s) as empty: %s", (input, _, expected) => {
    expect(isEmptyHtmlString(input, ["img"])).toBe(expected);
  });
});

describe("isCommentEmpty", () => {
  it.each([
    [undefined, true],
    ["", true],
    ["<p></p>", true],
    ["<p> </p>", true],
    ["<p>hello</p>", false],
    ['<p><mention-component id="1" label="Alice"></mention-component></p>', false],
    ['<image-component src="a"></image-component>', false],
    ['<p><img src="a.png"></p>', false],
  ])("treats %j as empty: %s", (input, expected) => {
    expect(isCommentEmpty(input)).toBe(expected);
  });

  it("handles JSON content", () => {
    expect(isCommentEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(
      isCommentEmpty({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] })
    ).toBe(false);
  });
});

describe("isStringCommentEmpty", () => {
  it.each([
    ["<p></p>", true],
    ['<embed-component src="a"></embed-component>', false],
    ["<p>text</p>", false],
  ])("treats %j as empty: %s", (input, expected) => {
    expect(isStringCommentEmpty(input)).toBe(expected);
  });
});
