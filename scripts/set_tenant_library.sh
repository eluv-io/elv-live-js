#!/bin/bash

set -Eeuo pipefail

# help function used when input parameters are empty
help_function()
{
    echo ""
    echo "Usage : ./set_library_tenant <owner_key> <comma separated libraries list> <tenant_contract_id>"
    exit 0 # Exit script after printing help
}

if [[ $# -lt 3 ]]; then
  help_function
fi

private_key=$1
libraries=$2
tenant_contract_id=$3

base_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
elv_live_js_dir="$(dirname "$base_dir")";
cmd="$elv_live_js_dir/elv-admin"

export PRIVATE_KEY=${private_key}
IFS="," read -r -a lib_arr <<< "$libraries";
for elem in "${lib_arr[@]}"; do
  out="$(${cmd} set_tenant_contract_id "$elem" "$tenant_contract_id")"
  if [[ $? -eq 0 ]]; then
    echo "Success: tenant_contract_id set on ${elem}"
  else
    echo "Failed: to set tenant_contract_id on ${elem}"
    echo "$out"
    exit 1
  fi
done





