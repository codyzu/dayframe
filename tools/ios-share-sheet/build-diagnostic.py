"""Build image-inspection or clipboard-handoff Shortcuts (standard library)."""

import argparse
import plistlib
import uuid
from pathlib import Path
from urllib.parse import urlsplit


def attachment(value):
    return {"Value": value, "WFSerializationType": "WFTextTokenAttachment"}


def text(parts):
    value = ""
    attachments = {}
    for part in parts:
        if isinstance(part, dict):
            attachments[f"{{{len(value)}, 1}}"] = part
            value += "\ufffc"
        else:
            value += part
    return {
        "Value": {"string": value, "attachmentsByRange": attachments},
        "WFSerializationType": "WFTextTokenString",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--clipboard-url",
        help="HTTPS diagnostic page; enables the clipboard handoff mode",
    )
    parser.add_argument("--normalize-png", action="store_true",
                        help="Convert each input to PNG before clipboard handoff")
    parser.add_argument("--admin-import", action="store_true",
                        help="Open the authenticated admin clipboard import section")
    args = parser.parse_args()
    if args.admin_import and (not args.clipboard_url or not args.normalize_png):
        parser.error("--admin-import requires --clipboard-url and --normalize-png")
    if args.normalize_png and not args.clipboard_url:
        parser.error("--normalize-png requires --clipboard-url")
    if args.clipboard_url:
        parsed = urlsplit(args.clipboard_url)
        if (
            parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment
        ):
            parser.error(
                "Clipboard URL must be HTTPS without credentials, query or fragment"
            )
    actions = []

    def action(identifier, **parameters):
        identifier_uuid = str(uuid.uuid4()).upper()
        parameters["UUID"] = identifier_uuid
        actions.append({
            "WFWorkflowActionIdentifier": "is.workflow.actions." + identifier,
            "WFWorkflowActionParameters": parameters,
        })
        return {"Type": "ActionOutput", "OutputUUID": identifier_uuid}

    shortcut_input = attachment({"Type": "ExtensionInput"})
    repeat_item = attachment({"Type": "Variable", "VariableName": "Repeat Item"})
    action(
        "comment",
        WFCommentActionText=(
            "Clipboard mode copies shared images locally and opens the configured HTTPS page. "
            "It replaces clipboard contents. "
            + ("Original photos remain in your photo library. Shared copies are resized "
               "to at most 1600 pixels on the longest edge, without upscaling, then "
               "converted to PNG. " if args.admin_import
               else "Use only synthetic test images. ")
            + 
            "The page reads images only after Paste. "
            + ("Review previews and confirm Add to collection to upload using browser sign-in. "
               if args.admin_import else "The diagnostic page never uploads them. ")
            if args.clipboard_url else
            "Dayframe diagnostic v1. Local inspection only: no network, no upload, "
            "no credentials, no saving or deleting photos. Share 1 or 3 synthetic "
            "images from Photos. The report describes the shared representations, "
            "not necessarily the originals. Close the report to view the images."
        ),
    )
    count = action("count", Input=shortcut_input, WFCountType="Items")
    if args.clipboard_url:
        clipboard_input = shortcut_input
        if args.normalize_png:
            group = str(uuid.uuid4()).upper()
            action("repeat.each", WFInput=shortcut_input,
                   GroupingIdentifier=group, WFControlFlowMode=0)
            image_input = repeat_item
            if args.admin_import:
                # Clamp the target edge before resizing: small inputs must not grow.
                dimensions = [action("properties.images", WFInput=repeat_item,
                                     WFContentItemPropertyName=name)
                              for name in ["Width", "Height"]]
                # Shortcuts' expression engine supports abs, but not min/max.
                longest = action("calculateexpression", Input=text([
                    "(", dimensions[0], "+", dimensions[1], "+abs(",
                    dimensions[0], "-", dimensions[1], "))/2",
                ]))
                edge = action("calculateexpression", Input=text([
                    "(1600+", longest, "-abs(1600-", longest, "))/2",
                ]))
                resized = action("image.resize", WFImage=repeat_item,
                                 WFImageResizeKey="Longest Edge",
                                 WFImageResizeLength=attachment(edge))
                image_input = attachment(resized)
            action("image.convert", WFInput=image_input, WFImageFormat="PNG",
                   WFImagePreserveMetadata=False)
            repeated = action("repeat.each", GroupingIdentifier=group,
                              WFControlFlowMode=2)
            clipboard_input = attachment(repeated)
        action("setclipboard", WFInput=clipboard_input, WFLocalOnly=True)
        url = action("url", WFURLActionURL=text([
            args.clipboard_url, "?expected=", count,
            "&variant=", "png" if args.normalize_png else "mixed",
            "&import=clipboard" if args.admin_import else "",
        ]))
        action("openurl", WFInput=attachment(url))
    else:
        group = str(uuid.uuid4()).upper()
        action(
            "repeat.each", WFInput=shortcut_input,
            GroupingIdentifier=group, WFControlFlowMode=0,
        )
        properties = {}
        for name in ["Width", "Height", "Orientation", "File Extension", "File Size"]:
            properties[name] = action(
                "properties.images", WFInput=repeat_item,
                WFContentItemPropertyName=name,
            )
        action("gettext", WFTextActionText=text([
            "Image ", {"Type": "Variable", "VariableName": "Repeat Index"},
            "\nDimensions: ", properties["Width"], " x ", properties["Height"],
            "\nOrientation: ", properties["Orientation"],
            "\nExtension: ", properties["File Extension"],
            "\nSize: ", properties["File Size"], "\n",
        ]))
        repeated = action(
            "repeat.each", GroupingIdentifier=group, WFControlFlowMode=2,
        )
        action("showresult", Text=text([
            "Dayframe — diagnostic v1\nReceived: ", count,
            " image(s)\n\n", repeated,
            "\nShared representation only. No upload. Close to preview.",
        ]))
        action("previewdocument", WFInput=shortcut_input)
    workflow = {
        "WFWorkflowName": "Dayframe Photo Paste" if args.clipboard_url else "Dayframe Photo Test",
        "WFWorkflowClientVersion": "4711",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": -615917313,
            "WFWorkflowIconGlyphNumber": 61440,
        },
        "WFWorkflowActions": actions,
        "WFWorkflowInputContentItemClasses": ["WFImageContentItem"],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowImportQuestions": [],
        "WFWorkflowTypes": ["ActionExtension"],
        "WFQuickActionSurfaces": [],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY))
    print(f"Wrote {args.output} ({len(actions)} actions).")


if __name__ == "__main__":
    main()
