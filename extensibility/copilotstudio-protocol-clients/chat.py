"""Optional launcher. Each protocol client also runs directly."""

import argparse

import a2a_client
import mcp_client


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Choose a Copilot Studio chat protocol.", add_help=False)
    parser.add_argument("--protocol", choices=["mcp", "a2a"], required=True)
    args, remaining = parser.parse_known_args(argv)
    client = mcp_client if args.protocol == "mcp" else a2a_client
    return client.main(remaining)


if __name__ == "__main__":
    raise SystemExit(main())
