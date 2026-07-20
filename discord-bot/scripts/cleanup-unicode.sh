#!/bin/bash
# Strip problematic Unicode characters from bot JS files
# Run from discord-bot/ directory
# Characters: ● (bullet U+25CF), – (en dash U+2013), ° (degree U+00B0)

echo "Cleaning up Unicode artifacts from bot files..."
cd "$(dirname "$0")/.."

find . -name '*.js' -not -path '*/node_modules/*' | while read f; do
    # Remove ● bullet characters entirely (used as comment decoration)
    sed -i 's/●//g' "$f"
    # Replace – en dash with ASCII --
    sed -i 's/–/--/g' "$f"
done

echo "Done - cleaned up all .js files"
