import os
import sys

try:
    import yaml
except ImportError:
    print("PyYAML not installed, installing or using alternative...")
    sys.exit(2)

workflows_dir = os.path.join(os.path.dirname(__file__), "..", ".github", "workflows")
files = [f for f in os.listdir(workflows_dir) if f.endswith(".yml") or f.endswith(".yaml")]

print(f"Auditing {len(files)} workflow files with PyYAML...")
all_valid = True

for f in sorted(files):
    filepath = os.path.join(workflows_dir, f)
    with open(filepath, "r", encoding="utf-8") as stream:
        try:
            yaml.safe_load(stream)
            print(f"  [VALID] {f}")
        except yaml.YAMLError as exc:
            all_valid = False
            print(f"  [SYNTAX ERROR] {f}:")
            print(f"    {exc}")

if not all_valid:
    sys.exit(1)
else:
    print("All workflows have valid YAML syntax!")
