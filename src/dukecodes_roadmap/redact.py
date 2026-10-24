"""Swap private addresses and internal names for documentation examples.

Readable output matters: evidence such as an nmap scan should still make sense after
redaction, so each private /24 keeps its last octet when there are three or fewer.
It replaces exactly what the leak scan finds, so redacted text always passes `roadmap check`.
"""

from __future__ import annotations

from collections.abc import Callable

from .checks import find_leaks

DOC_V4 = ("192.0.2", "198.51.100", "203.0.113")  # RFC 5737
DOC_V6 = "2001:db8::"  # RFC 3849
DOC_MAC = "00:00:5e:00:53:"  # RFC 7042


def _mapping(tokens: dict[str, list[str]]) -> dict[str, str]:
    pairs: dict[str, str] = {}
    v4 = tokens["ipv4"]
    nets = list(dict.fromkeys(a.rsplit(".", 1)[0] for a in v4))
    if len(nets) <= len(DOC_V4):
        for a in v4:
            prefix, last = a.rsplit(".", 1)
            pairs[a] = f"{DOC_V4[nets.index(prefix)]}.{last}"
    else:
        if len(v4) > 254 * len(DOC_V4):
            raise ValueError("too many private addresses to redact automatically")
        for i, a in enumerate(v4):
            pairs[a] = f"{DOC_V4[i // 254]}.{i % 254 + 1}"
    for i, a in enumerate(tokens["ipv6"], start=1):
        pairs[a] = f"{DOC_V6}{i:x}"
    # One device keeps one replacement, however its MAC or hostname is spelled.
    mac_ids = _numbered(tokens["mac"], lambda m: m.lower().replace("-", ":"))
    if len(set(mac_ids.values())) > 255:
        raise ValueError("too many MAC addresses to redact automatically")
    for mac, i in mac_ids.items():
        pairs[mac] = f"{DOC_MAC}{i:02x}"
    for h, i in _numbered(tokens["host"], str.lower).items():
        pairs[h] = f"host-{i}.tailnet.example" if h.lower().endswith("ts.net") else f"host-{i}.example"
    return pairs


def _numbered(tokens: list[str], key: Callable[[str], str]) -> dict[str, int]:
    """Number tokens from 1 in order of appearance; tokens with the same key share a number."""
    ids: dict[str, int] = {}
    out: dict[str, int] = {}
    for tok in tokens:
        out[tok] = ids.setdefault(key(tok), len(ids) + 1)
    return out


def redact(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Return the redacted text and the (old, new) pairs, in order of first appearance."""
    leaks = find_leaks(text)
    tokens: dict[str, list[str]] = {"ipv4": [], "ipv6": [], "mac": [], "host": []}
    for lk in leaks:
        if lk.token not in tokens[lk.kind]:
            tokens[lk.kind].append(lk.token)
    pairs = _mapping(tokens)
    out: list[str] = []
    used: dict[str, str] = {}
    pos = 0
    for lk in leaks:
        if lk.start < pos:  # inside a longer hit already replaced, such as an address in a hostname
            continue
        out += [text[pos : lk.start], pairs[lk.token]]
        used.setdefault(lk.token, pairs[lk.token])
        pos = lk.end
    out.append(text[pos:])
    return "".join(out), list(used.items())
