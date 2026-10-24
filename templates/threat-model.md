# Threat model: <system>

**Version:** 1 · **Date:** YYYY-MM-DD · **Scope:** what's in, and what's out

Four questions: what are we working on? What can go wrong? What are we going to do about it? Did we do a good job?

## What we're protecting
| Asset | Why it matters | Where it lives |
|-------|----------------|----------------|
| Admin accounts | Whoever holds them owns everything | Password manager, admin device |

## Who we're protecting it from
| Attacker | Wants | Can |
|----------|-------|-----|
| Internet scanner | Any open service | Scan every public address, all day |
| Malware on an IoT device | A foothold to spread from | Reach whatever its network allows |
| A poisoned dependency | Your secrets, your build | Run code wherever it's installed |

## Diagram and trust boundaries
Draw it in Mermaid. Mark each boundary: internet and router, IoT and home network, DevSec lab and home, laptop and GitHub.

## Threats
STRIDE: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

| # | Boundary | Threat | STRIDE | Mitigation, or "accepted because…" | Status |
|---|----------|--------|--------|-------------------------------------|--------|
| T1 | IoT and home | A hacked smart plug scans the home network | I, E | IoT network can't open connections to the home network | planned |

## Did we do a good job?
Which threat has the weakest mitigation? Revisit this file at the end of every milestone.
