"""`roadmap redact`: readable output that always passes the leak scan."""

from __future__ import annotations

import pytest
from conftest import dotted, lan_host, mac, private_ip, tailnet_host, ula

from dukecodes_roadmap.checks import find_leaks
from dukecodes_roadmap.redact import redact


def test_nothing_to_redact() -> None:
    text = f"public {dotted(8, 8, 8, 8)} and docs {dotted(192, 0, 2, 1)}\n"
    assert redact(text) == (text, [])


def test_one_subnet_keeps_last_octets() -> None:
    a, b = private_ip(1), private_ip(15)
    new, pairs = redact(f"{a} talks to {b}, then {a} again.\n")
    assert new == "192.0.2.1 talks to 192.0.2.15, then 192.0.2.1 again.\n"
    assert pairs == [(a, "192.0.2.1"), (b, "192.0.2.15")]


def test_ports_cidr_and_sentence_ends_are_redacted() -> None:
    a = private_ip(7)
    new, _ = redact(f"https://{a}:8006/ and {a}/24 and {a}.\n")
    assert new == "https://192.0.2.7:8006/ and 192.0.2.7/24 and 192.0.2.7.\n"


def test_up_to_three_subnets_map_one_to_one() -> None:
    a, b, c = private_ip(1), dotted(192, 168, 50, 9), dotted(172, 16, 3, 4)
    new, _ = redact(f"{a} {b} {c}")
    assert new == "192.0.2.1 198.51.100.9 203.0.113.4"


def test_more_subnets_number_addresses_in_order() -> None:
    addrs = [private_ip(9, (10, 0, n)) for n in range(4)]
    new, _ = redact(" ".join(addrs))
    assert new == "192.0.2.1 192.0.2.2 192.0.2.3 192.0.2.4"


def test_too_many_addresses_fail_loudly() -> None:
    addrs = [private_ip(last, (10, 0, n)) for n in range(4) for last in range(1, 255)]
    with pytest.raises(ValueError, match="too many private addresses"):
        redact("\n".join(addrs))


def test_too_many_macs_fail_loudly() -> None:
    macs = [":".join(["aa", "bb", "cc", "dd", f"{i // 256:02x}", f"{i % 256:02x}"]) for i in range(256)]
    with pytest.raises(ValueError, match="too many MAC addresses"):
        redact("\n".join(macs))


def test_macs_ipv6_and_hostnames() -> None:
    text = f"{mac()} {mac().replace(':', '-')} {mac()}\n{ula()}\n{tailnet_host()} {lan_host()}\n"
    new, pairs = redact(text)
    assert new == (
        "00:00:5e:00:53:01 00:00:5e:00:53:01 00:00:5e:00:53:01\n"
        "2001:db8::1\n"
        "host-1.tailnet.example host-2.example\n"
    )
    assert [old for old, _ in pairs] == [mac(), mac().replace(":", "-"), ula(), tailnet_host(), lan_host()]


def test_same_host_in_any_case_gets_one_name() -> None:
    new, _ = redact(f"{tailnet_host()} {tailnet_host().upper()} {lan_host()}")
    assert new == "host-1.tailnet.example host-1.tailnet.example host-2.example"


def test_address_inside_a_hostname_is_replaced_once() -> None:
    host = f"{private_ip()}.home" + ".arpa"
    new, pairs = redact(f"ping {host}\n")
    assert new == "ping host-1.example\n"
    assert pairs == [(host, "host-1.example")]


def test_redacted_output_passes_the_scan() -> None:
    text = "\n".join([
        f"Nmap scan report for {lan_host()} ({private_ip(20)})",
        f"MAC Address: {mac().upper()} (Unknown)",
        f"inet6 {ula()}/64 scope global",
        f"https://{private_ip(20)}:8006, {private_ip(21)}.",
        f"tailscale: {dotted(100, 101, 2, 3)} {tailnet_host('pve')}",
    ])  # fmt: skip
    assert find_leaks(text)
    new, _ = redact(text)
    assert find_leaks(new) == []
    assert "Nmap scan report for host-1.example (192.0.2.20)" in new
