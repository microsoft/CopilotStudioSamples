"""Verify that the importable package and unpacked agent source stay in sync."""

import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import zipfile

import yaml

SAMPLE = Path(__file__).parent.parent
SCHEMA = "cr981_a2amcpsample_Sbs6q7"
PACKAGE = SAMPLE / "solution" / "CopilotStudioProtocolClients_1_0_0_0.zip"


class SolutionTests(unittest.TestCase):
    def test_zip_matches_unpacked_source(self):
        with zipfile.ZipFile(PACKAGE) as archive:
            self.assertIsNone(archive.testzip())
            expected = {"[Content_Types].xml"}
            for path in (SAMPLE / "src").rglob("*"):
                if not path.is_file():
                    continue
                relative = path.relative_to(SAMPLE / "src").as_posix()
                name = {
                    "Other/Solution.xml": "solution.xml",
                    "Other/Customizations.xml": "customizations.xml",
                }.get(relative, relative)
                expected.add(name)
                exported = archive.read(name)
                unpacked = path.read_bytes()
                if name.endswith(".xml"):
                    self.assertEqual(
                        ET.canonicalize(exported, strip_text=True),
                        ET.canonicalize(unpacked, strip_text=True), name,
                    )
                elif name.endswith(".json"):
                    self.assertEqual(json.loads(exported), json.loads(unpacked), name)
                else:
                    self.assertEqual(exported, unpacked, name)
            self.assertEqual(set(archive.namelist()), expected)

    def test_solution_identity_and_dependencies(self):
        manifest = ET.parse(SAMPLE / "src/Other/Solution.xml").getroot().find("SolutionManifest")
        self.assertEqual(manifest.findtext("UniqueName"), "CopilotStudioProtocolClients")
        self.assertEqual(manifest.findtext("Version"), "1.0.0.0")
        self.assertEqual(manifest.findtext("Managed"), "0")
        self.assertEqual(len(manifest.find("MissingDependencies")), 0)
        bot = ET.parse(SAMPLE / "src/bots" / SCHEMA / "bot.xml").getroot()
        self.assertEqual(bot.findtext("name"), "A2A MCP Sample")
        self.assertEqual(bot.findtext("template"), "cliagent-1.0.0")
        self.assertEqual(len(list((SAMPLE / "src/bots").iterdir())), 1)

    def test_skills_instructions_and_knowledge_match_authoring_files(self):
        config = json.loads((SAMPLE / "src/bots" / SCHEMA / "configuration.json").read_text())
        authoring = SAMPLE / "agent/A2A MCP Sample"
        settings = yaml.safe_load((authoring / "settings.mcs.yml").read_text())
        expected = settings["configuration"]["agentSettings"]
        actual = config["agentSettings"]
        self.assertEqual(
            [{key: value for key, value in skill.items() if key != "$kind"} for skill in actual["a2A"]["skills"]],
            expected["a2A"]["skills"],
        )
        self.assertEqual(actual["instructions"]["segments"][0]["value"], expected["instructions"]["segments"][0]["value"])
        websites = set()
        for component in (SAMPLE / "src/botcomponents").iterdir():
            definition = yaml.safe_load((component / "data").read_text())
            if definition["kind"] == "KnowledgeSourceConfiguration":
                self.assertEqual(definition["source"]["kind"], "WebsiteKnowledgeSource")
                websites.add(definition["source"]["siteUrl"])
            metadata = ET.parse(component / "botcomponent.xml").getroot()
            self.assertEqual(metadata.findtext("parentbotid/schemaname"), SCHEMA)
        self.assertEqual(websites, {
            "https://www.kingarthurbaking.com/recipes",
            "https://ooni.com/blogs/recipes",
            "https://www.bbcgoodfood.com/recipes",
        })
        self.assertEqual(len(list((SAMPLE / "src/botcomponents").iterdir())), 4)
