#!/usr/bin/env python3
"""Summarize a private run without printing raw evidence or granting acceptance."""

import argparse
import csv
import json
from pathlib import Path
import statistics


def summary(rows):
    good = [row for row in rows if row['status'] == 'ok']
    result = {'rows': len(rows), 'ok': len(good),
              'incomplete_or_absent': len(rows) - len(good)}
    for name in ['pss_kib', 'mem_free_kib', 'swap_free_kib', 'cpu_capacity_percent']:
        values = [float(row[name]) for row in good if row.get(name)]
        result[name] = ({'first': values[0], 'last': values[-1],
                         'min': min(values), 'median': statistics.median(values),
                         'max': max(values)} if values else None)
    elapsed = [float(row['elapsed_seconds']) for row in rows if row.get('elapsed_seconds')]
    result['observed_span_seconds'] = elapsed[-1] - elapsed[0] if elapsed else 0
    result['max_sample_gap_seconds'] = max((b - a for a, b in zip(elapsed, elapsed[1:])), default=0)
    result['main_pid_changes'] = sum(row.get('main_pid_changed') == 'True' for row in rows)
    result['process_set_changes'] = sum(row.get('process_set_changed') == 'True' for row in rows)
    result['acceptance'] = 'Manual review required; statistics do not prove page health or a memory leak.'
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    args = parser.parse_args()
    with (args.run / 'samples.csv').open(newline='') as stream:
        print(json.dumps(summary(list(csv.DictReader(stream))), indent=2))
