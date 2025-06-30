#!/bin/bash

set -Eeuo pipefail

# help function used when input parameters are empty
help_function()
{
  echo "export PRIVATE_KEY='<fund_providing_key>'"
  echo "Usage: ./send_funds <file-path> <funds> <threshold>"
  echo "file provided contains list of addresses to be funded"
  exit 0
}

if [[ $# -lt 3 ]]; then
  help_function
fi

if ! command -v awk >/dev/null 2>&1; then
  echo "Error: 'awk' is not installed. Please install it to continue"
  exit 1
fi

file=$1
funds=$2
threshold=$3

base_dir="$(cd "$(dirname ${BASH_SOURCE[0]})" && pwd)"
elv_live_js_dir="$(dirname $base_dir)"
cmd="$elv_live_js_dir/elv-admin"

if ! env | grep -q "^PRIVATE_KEY"; then
  echo "Error: PRIVATE_KEY is not exported"
  exit 1
fi

#exec 3< "$file"
while IFS= read -r user;do
  user="$(echo "$user" | xargs)"
  echo $user

  balance="$(${cmd} account_balance "${user}")"
  if [[ "$balance" == *"error"* || $? -ne 0 ]]; then
    echo "Failed: To get balance for ${user}"
    continue;
  fi
  echo "Balance before: $balance";


  if [[ $(awk "BEGIN {print ($balance < $threshold)}") -eq 1 ]]; then
    out="$(${cmd} account_send "$user" "$funds")";
    if [[ "$out" == *"error"* || $? -ne 0 ]]; then
      echo "Failed: To send funds to ${user}"
      echo "$out";
      continue;
    else
      echo "Success: Funds transferred to ${user}"
    fi
  fi

  balance="$(${cmd} account_balance "${user}")"
    if [[ "$balance" == *"error"* || $? -ne 0 ]]; then
      echo "Failed: To get balance for ${user}";
      continue;
    fi
  echo "balance after: $balance";
  echo "==========================";

done < $file


