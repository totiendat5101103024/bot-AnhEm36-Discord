'use strict';

/**
 * harness.js — bộ kiểm thử tối giản, không phụ thuộc thư viện ngoài.
 */

const results = [];

function test(name, fn) {
    try {
        fn();
        results.push({ name, ok: true });
    } catch (err) {
        results.push({ name, ok: false, error: err.message });
    }
}

function assert(cond, message) {
    if (!cond) throw new Error(message || 'assert thất bại');
}

function eq(actual, expected, message) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        throw new Error(`${message || 'eq thất bại'}: nhận ${a}, mong đợi ${b}`);
    }
}

function throws(fn, message) {
    let threw = false;
    try {
        fn();
    } catch {
        threw = true;
    }
    if (!threw) throw new Error(message || 'mong đợi ném lỗi nhưng không');
}

function report() {
    let passed = 0;
    let failed = 0;
    for (const r of results) {
        if (r.ok) {
            passed += 1;
            console.log(`  ✅ ${r.name}`);
        } else {
            failed += 1;
            console.log(`  ❌ ${r.name}\n     → ${r.error}`);
        }
    }
    console.log(`\n${failed === 0 ? '✅ PASS' : '❌ FAIL'} — ${passed} pass, ${failed} fail, ${results.length} test\n`);
    return failed === 0;
}

module.exports = { test, assert, eq, throws, report, results };
