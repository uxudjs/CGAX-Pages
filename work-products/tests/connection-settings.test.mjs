import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');

function extractFunction(name) {
	const start = source.indexOf(`function ${name}(`);
	assert.notEqual(start, -1, `应能提取 ${name}`);
	const bodyStart = source.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index++) {
		if (source[index] === '{') depth++;
		if (source[index] === '}') depth--;
		if (depth === 0) return source.slice(start, index + 1);
	}
	assert.fail(`${name} 函数未闭合`);
}

function createConnectionProfileHarness() {
	const elements = {
		connectionProfile: { value: 'balanced' },
		connectionCustomSettings: { hidden: true },
		preloadRaceDial: { checked: false },
		tcpConcurrentDial: { value: '2' },
		proxyConcurrentDial: { value: '1' },
		keepaliveInterval: { value: '30000' }
	};
	const document = { getElementById: id => elements[id] };
	let modifiedCount = 0;
	const names = [
		'readConnectionSettingsForm',
		'inferConnectionProfile',
		'syncConnectionCustomSettingsVisibility',
		'syncConnectionProfileSelection',
		'applyConnectionProfile',
		'handleConnectionProfileChange',
		'handleConnectionSettingChange'
	];
	const functions = names.map(extractFunction).join('\n');
	const api = Function('document', 'CONNECTION_PROFILES', 'markModified', `
		${functions}
		return {
			readConnectionSettingsForm,
			syncConnectionProfileSelection,
			handleConnectionProfileChange,
			handleConnectionSettingChange
		};
	`)(document, {
		balanced: { preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 30000 },
		long_lived: { preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 15000 },
		weak_network: { preloadRaceDial: true, tcpConcurrentDial: 3, proxyConcurrentDial: 2, keepaliveInterval: 30000 },
		resource_saver: { preloadRaceDial: false, tcpConcurrentDial: 1, proxyConcurrentDial: 1, keepaliveInterval: 60000 }
	}, () => modifiedCount++);

	return { api, elements, getModifiedCount: () => modifiedCount };
}

function createConnectionProfileHelpHarness() {
	const visibleClasses = new Set();
	const listeners = new Map();
	let activeElement = null;
	const closeButton = {
		focusCount: 0,
		focus() {
			this.focusCount++;
			activeElement = this;
		}
	};
	const helpButton = {
		focusCount: 0,
		focus() {
			this.focusCount++;
			activeElement = this;
		}
	};
	const elements = {
		connectionProfile: { value: 'balanced', selectedOptions: [{ textContent: '网页/视频（均衡）' }] },
		connectionProfileHelpProfileName: { textContent: '' },
		connectionProfileHelpDescription: { textContent: '' },
		connectionProfileHelpModal: {
			classList: {
				add: value => visibleClasses.add(value),
				remove: value => visibleClasses.delete(value)
			},
			querySelectorAll: () => [closeButton]
		},
		connectionProfileHelpClose: closeButton,
		connectionProfileHelpButton: helpButton
	};
	const document = {
		getElementById: id => elements[id],
		get activeElement() { return activeElement; },
		addEventListener: (type, listener) => listeners.set(type, listener),
		removeEventListener: (type, listener) => {
			if (listeners.get(type) === listener) listeners.delete(type);
		}
	};
	const functions = [
		'handleConnectionProfileHelpKeydown',
		'showConnectionProfileHelpModal',
		'closeConnectionProfileHelpModal'
	].map(extractFunction).join('\n');
	const api = Function('document', 'CONNECTION_PROFILES', `
		${functions}
		return { showConnectionProfileHelpModal, closeConnectionProfileHelpModal };
	`)(document, { balanced: { description: '均衡场景说明' } });

	return { api, elements, listeners, visibleClasses };
}

function createSaveProxyHarness() {
	const elements = {
		autoProxy: { checked: true },
		proxyIP: { value: '' },
		preloadRaceDial: { checked: false },
		tcpConcurrentDial: { value: '2' },
		proxyConcurrentDial: { value: '1' },
		keepaliveInterval: { value: '15000' },
		connectionProfile: { value: 'custom' },
		connectionCustomSettings: { hidden: false }
	};
	const document = { getElementById: id => elements[id] };
	const currentConfig = {
		反代: {
			PROXYIP: 'auto',
			SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] }
		},
		连接设置: {}
	};
	let saveCount = 0;
	const saveProxy = Function(
		'document',
		'currentConfig',
		'getEffectiveProxyMode',
		'showToast',
		'httpsProxyFeatureEnabled',
		'turnSstpProxyFeatureEnabled',
		'saveConfigToServer',
		`async ${extractFunction('saveProxy')}; return saveProxy;`
	)(document, currentConfig, () => 'auto', () => {}, false, false, async () => { saveCount++; });

	return { saveProxy, currentConfig, elements, getSaveCount: () => saveCount };
}

function createSaveConfigHarness({ initialConfig, editedConfig, responseOk }) {
	const match = source.match(/async function saveConfigToServer\(section\) \{[\s\S]*?\r?\n\t\t\}(?=\r?\n\r?\n\t\tfunction cancelEdit)/);
	assert.ok(match, '应能提取 saveConfigToServer');

	return Function('initialConfig', 'editedConfig', 'responseOk', `
		let originalConfig = structuredClone(initialConfig);
		let currentConfig = structuredClone(editedConfig);
		const fetch = async () => ({ ok: responseOk });
		const showToast = () => {};
		const modifiedSections = new Set(['proxy']);
		const updateButtonStates = () => {};
		${match[0]}
		return {
			save: () => saveConfigToServer('proxy'),
			getOriginalConfig: () => originalConfig
		};
	`)(initialConfig, editedConfig, responseOk);
}

test('管理页提供四项连接设置，并保留各自的最小值', () => {
	assert.match(source, /id="preloadRaceDial"/);
	assert.match(source, /id="tcpConcurrentDial" min="1"/);
	assert.match(source, /id="proxyConcurrentDial" min="1"/);
	assert.match(source, /id="keepaliveInterval" min="1000"/);
});

test('连接设置的开关不会被模块通用输入布局拉伸', () => {
	assert.match(source, /\.connection-settings \.(?:checkbox-group )?input\[type="checkbox"\]\s*\{[\s\S]*?flex:\s*0 0 18px/);
});

test('连接场景提示标签不会被通用下边距顶高', () => {
	assert.match(source, /\.connection-settings\s*>\s*\.form-group\s*>\s*\.label-with-hint\s*\{[^}]*margin-bottom:\s*0/);
});

test('管理页回填、校验并保存连接设置', () => {
	assert.match(source, /const connectionSettings = currentConfig\.连接设置 \|\| \{\};/);
	assert.match(source, /currentConfig\.连接设置 = \{/);
	assert.match(source, /连接保活间隔毫秒: keepaliveInterval/);
	assert.match(source, /keepaliveInterval < 1000/);
});

test('管理页提供五种连接场景与四组精确预设', () => {
	assert.match(source, /<div class="label-with-hint">\s*<label for="connectionProfile">使用场景<\/label>\s*<button[^>]*id="connectionProfileHelpButton"[^>]*class="inline-hint-btn"[^>]*title="查看使用场景说明"[^>]*aria-label="查看使用场景说明"/);
	assert.match(source, /<select id="connectionProfile"[\s\S]*?<option value="balanced">网页\/视频（均衡）<\/option>[\s\S]*?<option value="long_lived">WS\/gRPC 长连接<\/option>[\s\S]*?<option value="weak_network">弱网快速建连<\/option>[\s\S]*?<option value="resource_saver">节省连接资源<\/option>[\s\S]*?<option value="custom">自定义<\/option>[\s\S]*?<\/select>/);
	assert.match(source, /balanced:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 30000/);
	assert.match(source, /long_lived:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 15000/);
	assert.match(source, /weak_network:\s*Object\.freeze\(\{ preloadRaceDial: true, tcpConcurrentDial: 3, proxyConcurrentDial: 2, keepaliveInterval: 30000/);
	assert.match(source, /resource_saver:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 1, proxyConcurrentDial: 1, keepaliveInterval: 60000/);
});

test('连接场景按加载值推断，预设写值，自定义编辑保持展开', () => {
	const { api, elements, getModifiedCount } = createConnectionProfileHarness();

	api.syncConnectionProfileSelection();
	assert.equal(elements.connectionProfile.value, 'balanced');
	assert.equal(elements.connectionCustomSettings.hidden, true);

	elements.connectionProfile.value = 'custom';
	const beforeCustom = api.readConnectionSettingsForm();
	api.handleConnectionProfileChange();
	assert.deepEqual(api.readConnectionSettingsForm(), beforeCustom);
	assert.equal(elements.connectionProfile.value, 'custom');
	assert.equal(elements.connectionCustomSettings.hidden, false);
	assert.equal(getModifiedCount(), 0);

	elements.keepaliveInterval.value = '15000';
	api.handleConnectionSettingChange();
	assert.equal(elements.connectionProfile.value, 'custom');
	assert.equal(elements.connectionCustomSettings.hidden, false);
	assert.equal(getModifiedCount(), 1);

	const presetCases = {
		balanced: { preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 30000 },
		long_lived: { preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 15000 },
		weak_network: { preloadRaceDial: true, tcpConcurrentDial: 3, proxyConcurrentDial: 2, keepaliveInterval: 30000 },
		resource_saver: { preloadRaceDial: false, tcpConcurrentDial: 1, proxyConcurrentDial: 1, keepaliveInterval: 60000 }
	};
	for (const [profileId, expectedSettings] of Object.entries(presetCases)) {
		elements.connectionProfile.value = profileId;
		api.handleConnectionProfileChange();
		assert.deepEqual(api.readConnectionSettingsForm(), expectedSettings);
		assert.equal(elements.connectionCustomSettings.hidden, true);
	}
	assert.equal(getModifiedCount(), 5);

	elements.tcpConcurrentDial.value = '4';
	api.syncConnectionProfileSelection();
	assert.equal(elements.connectionProfile.value, 'custom');
	assert.equal(elements.connectionCustomSettings.hidden, false);
});

test('四项设置仅在自定义容器中呈现，隐藏时仍参与保存', () => {
	const container = source.match(/<div id="connectionCustomSettings"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0];
	assert.ok(container, '应存在自定义设置容器');
	for (const id of ['preloadRaceDial', 'tcpConcurrentDial', 'proxyConcurrentDial', 'keepaliveInterval']) {
		assert.match(container, new RegExp(`id="${id}"`));
	}
	assert.doesNotMatch(container, /\bdisabled\b/);
	assert.match(source, /applyProxyConfigToForm\(\)[\s\S]*?syncConnectionProfileSelection\(\);/);
	assert.doesNotMatch(source, /await saveConfigToServer\('proxy'\);\s*syncConnectionProfileSelection\(\);/);
	assert.match(source, /currentConfig\.连接设置 = \{[\s\S]*?预加载竞速拨号:[\s\S]*?TCP并发拨号数:[\s\S]*?反代并发拨号数:[\s\S]*?连接保活间隔毫秒:/);
});

test('使用场景说明移入独立无障碍模态框', () => {
	assert.doesNotMatch(source, /<p id="connectionProfileDescription"/);
	assert.doesNotMatch(source, /<ul id="connectionProfileNotes"/);
	assert.match(source, /id="connectionProfileHelpModal"[^>]*onclick="closeConnectionProfileHelpModal\(event\)"[\s\S]*?role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="connectionProfileHelpTitle"/);
	assert.match(source, /id="connectionProfileHelpClose"[^>]*aria-label="关闭使用场景说明"/);
	assert.match(source, /id="connectionProfileHelpDescription"/);
	assert.match(source, /环境变量存在时优先，可能覆盖此处保存值/);
	assert.match(source, /设置只影响新建连接，现有长连接需重连/);
	assert.match(source, /竞速主要影响建连与失败切换，不直接提高视频吞吐/);
	assert.match(source, /WS\/gRPC 长连接预设的保活值不作用于 XHTTP/);
	assert.match(source, /document\.addEventListener\('keydown', handleConnectionProfileHelpKeydown\)/);
	assert.match(source, /document\.removeEventListener\('keydown', handleConnectionProfileHelpKeydown\)/);
	assert.match(source, /if \(event\.key === 'Escape'\) \{[\s\S]*?closeConnectionProfileHelpModal\(\);[\s\S]*?return;[\s\S]*?\}/);
	assert.match(source, /document\.getElementById\('connectionProfileHelpButton'\)\.focus\(\)/);
});

test('使用场景说明每次打开更新内容，约束 Tab 焦点并在关闭后返回入口', () => {
	const { api, elements, listeners, visibleClasses } = createConnectionProfileHelpHarness();

	api.showConnectionProfileHelpModal();
	assert.equal(elements.connectionProfileHelpProfileName.textContent, '网页/视频（均衡）');
	assert.equal(elements.connectionProfileHelpDescription.textContent, '均衡场景说明');
	assert.equal(visibleClasses.has('show'), true);
	assert.equal(elements.connectionProfileHelpClose.focusCount, 1);
	assert.equal(listeners.size, 1);

	api.showConnectionProfileHelpModal();
	assert.equal(listeners.size, 1);
	let preventedTabCount = 0;
	listeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() { preventedTabCount++; } });
	listeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() { preventedTabCount++; } });
	assert.equal(preventedTabCount, 2);
	assert.equal(elements.connectionProfileHelpClose.focusCount, 4);
	listeners.get('keydown')({ key: 'Escape' });
	assert.equal(visibleClasses.has('show'), false);
	assert.equal(listeners.size, 0);
	assert.equal(elements.connectionProfileHelpButton.focusCount, 1);
});

test('自定义设置保存成功后保持当前会话展开', async () => {
	const { saveProxy, currentConfig, elements, getSaveCount } = createSaveProxyHarness();

	await saveProxy();

	assert.equal(getSaveCount(), 1);
	assert.equal(elements.connectionProfile.value, 'custom');
	assert.equal(elements.connectionCustomSettings.hidden, false);
	assert.deepEqual(currentConfig.连接设置, {
		预加载竞速拨号: false,
		TCP并发拨号数: 2,
		反代并发拨号数: 1,
		连接保活间隔毫秒: 15000
	});
});

test('保存成功后更新取消基线，保存失败时保留旧基线', async () => {
	const initialConfig = { 连接设置: { 连接保活间隔毫秒: 30000 } };
	const editedConfig = { 连接设置: { 连接保活间隔毫秒: 15000 } };
	const successfulSave = createSaveConfigHarness({ initialConfig, editedConfig, responseOk: true });
	await successfulSave.save();
	assert.deepEqual(successfulSave.getOriginalConfig(), editedConfig);

	const failedSave = createSaveConfigHarness({ initialConfig, editedConfig, responseOk: false });
	await failedSave.save();
	assert.deepEqual(failedSave.getOriginalConfig(), initialConfig);
});
