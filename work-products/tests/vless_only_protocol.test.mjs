import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminSource = await readFile(new URL('../../admin/index.html', import.meta.url), 'utf8');

test('管理页不再提供 Trojan 节点协议', () => {
	assert.equal(/trojan/i.test(adminSource), false);
	assert.match(adminSource, /<option value="vless">VLESS<\/option>/);
});

test('管理页节点协议固定为 VLESS 且不再读写 Shadowsocks 配置', () => {
	assert.equal(/Shadowsocks/i.test(adminSource), false);
	assert.equal(/option\[value="ss"\]|value="ss"/i.test(adminSource), false);
	assert.equal(/currentConfig\.SS|syncSSProtocolSettingsFromConfig|ssTLSDisableModal/i.test(adminSource), false);
	assert.match(adminSource, /currentConfig\.协议类型\s*=\s*'vless'/);
});
