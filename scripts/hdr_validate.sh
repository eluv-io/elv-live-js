#!/usr/bin/env bash

set -euo pipefail

BASE_DIR="$(pwd)/output"
OUTPUT_CSV="$(pwd)/output/hdr_report.csv"

echo "Scanning HDR JSON files..."

CHECKS=()

# ---------------- COLLECT + NORMALIZE CHECK NAMES ----------------

normalize_name() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr ' ' '_' \
    | tr '/' '_' \
    | tr -d '\r'
}

for obj_dir in "$BASE_DIR"/iq__*; do
  [[ -d "$obj_dir" ]] || continue

  for json in "$obj_dir"/videovideo*/hdr_result.json; do
    [[ -f "$json" ]] || continue

    while read -r name; do
      [[ -n "$name" ]] || continue

      clean_name=$(normalize_name "$name")
      CHECKS+=("$clean_name")

    done < <(
      jq -r '.hdr.checks[]?.name' "$json" 2>/dev/null || true
    )

  done
done

# dedupe
CHECKS=($(printf "%s\n" "${CHECKS[@]:-}" | sort -u))

# ---------------- HEADER ----------------

mkdir -p "$(dirname "$OUTPUT_CSV")"

{
  printf "object_id,resolution"

  for c in "${CHECKS[@]}"; do
    printf ",%s" "$c"
  done

  printf "\n"
} > "$OUTPUT_CSV"

# ---------------- BUILD CSV ----------------

echo "Generating CSV..."

for obj_dir in "$BASE_DIR"/iq__*; do
  [[ -d "$obj_dir" ]] || continue

  object_id="$(basename "$obj_dir")"

  for json in "$obj_dir"/videovideo*/hdr_result.json; do
    [[ -f "$json" ]] || continue

    resolution="$(basename "$(dirname "$json")")"

    {
      printf "%s,%s" "$object_id" "$resolution"

      for c in "${CHECKS[@]}"; do

        ok=$(jq -r --arg name "$c" '
          .hdr.checks[]
          | select(
              (.name
               | ascii_downcase
               | gsub(" "; "_")
               | gsub("/"; "_")
               | gsub("\\r"; "")
              ) == $name
            )
          | .ok
        ' "$json" 2>/dev/null | head -n 1)

        ok=${ok:-false}

        if [[ "$ok" == "true" ]]; then
          printf ",PASS"
        else
          printf ",FAIL"
        fi

      done

      printf "\n"
    } >> "$OUTPUT_CSV"

  done
done

echo "======================================"
echo "DONE"
echo "CSV: $OUTPUT_CSV"
echo "======================================"