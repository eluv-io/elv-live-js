#!/bin/bash

set -Eeuo pipefail

# help function used when input parameters are empty
help_function()
{
    echo "export PRIVATE_KEY='<owner_key>'"
    echo "Usage : ./set_library_tenant <comma separated libraries list> <tenant_contract_id>"
    exit 0 # Exit script after printing help
}

if [[ $# -lt 2 ]]; then
  help_function
fi

libraries=$1
tenant_contract_id=$2

base_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
elv_live_js_dir="$(dirname "$base_dir")";
cmd="$elv_live_js_dir/elv-admin"

if ! env | grep -q "^PRIVATE_KEY="; then
  echo "Error: PRIVATE_KEY is not exported"
  exit 1
fi

IFS="," read -r -a lib_arr <<< "$libraries";
for elem in "${lib_arr[@]}"; do
  out="$(${cmd} set_tenant_contract_id "$elem" "$tenant_contract_id")";
  if [[ $out == *"error"* ]]; then
    echo "Failed: to set tenant_contract_id on ${elem}"
    echo "$out"
    exit 1
  else
    echo "Success: tenant_contract_id set on ${elem}"
  fi
done





