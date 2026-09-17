const overlay = document.querySelector('#modalOverlay');
const toast = document.querySelector('#toast');
const taskRows = document.querySelector('#taskRows');
let processMode = 'auto';
let selectedEnvironment = { name: '现代住宅 - 卧室', engine: 'PhysX', size: '4.0 × 3.5m', version: 'V2.4' };

function closeModal() { overlay.classList.add('hidden'); }
function openModal() { overlay.classList.remove('hidden'); }
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2500);
}

document.querySelector('#createTask').addEventListener('click', openModal);
document.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', closeModal));
overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });

const environmentOverlay = document.querySelector('#environmentOverlay');
function closeEnvironmentPicker() { environmentOverlay.classList.add('hidden'); }
document.querySelector('#selectEnvironment').addEventListener('click', () => environmentOverlay.classList.remove('hidden'));
document.querySelector('#closeEnvironment').addEventListener('click', closeEnvironmentPicker);
document.querySelector('#cancelEnvironment').addEventListener('click', closeEnvironmentPicker);
environmentOverlay.addEventListener('click', (event) => { if (event.target === environmentOverlay) closeEnvironmentPicker(); });
document.querySelector('#toggleEnvironmentFilter').addEventListener('click', () => document.querySelector('#environmentFilter').classList.toggle('hidden'));
document.querySelectorAll('[data-picker-tab]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-picker-tab]').forEach((item) => item.classList.toggle('active', item === button));
  showToast(button.dataset.pickerTab === 'scene' ? '场景列表待接入；当前仅可选择空环境' : '已切换至环境列表');
}));
document.querySelectorAll('#environmentRows tr').forEach((row) => row.addEventListener('click', () => { row.querySelector('input').checked = true; }));
document.querySelector('#confirmEnvironment').addEventListener('click', () => {
  const selectedRadio = document.querySelector('#environmentRows input:checked');
  if (!selectedRadio) { showToast('请选择一个空环境后再确定'); return; }
  const row = selectedRadio.closest('tr');
  selectedEnvironment = { name: row.dataset.name, engine: row.dataset.engine, size: row.dataset.size, version: row.dataset.version };
  document.querySelector('#selectedEnvironment').textContent = selectedEnvironment.name;
  document.querySelector('.env-preview p').textContent = `${selectedEnvironment.engine} · ${selectedEnvironment.size} · 环境版本 ${selectedEnvironment.version}`;
  closeEnvironmentPicker();
  showToast(`已选择环境：${selectedEnvironment.name}`);
});

const panels = { text: '#textPanel', image: '#imagePanel', import: '#importPanel' };
let activePromptMode = 'text';
let referenceUploaded = false;
let importedPrompt = '';
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  activePromptMode = button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
  Object.entries(panels).forEach(([mode, selector]) => document.querySelector(selector).classList.toggle('hidden', mode !== button.dataset.mode));
  document.querySelector('.rewrite').classList.toggle('hidden', activePromptMode === 'import');
  document.querySelector('#promptCompare').classList.add('hidden');
}));

const imagePanel = document.querySelector('#imagePanel');
const imagePromptField = document.createElement('label');
imagePromptField.className = 'field image-reference-prompt';
imagePromptField.innerHTML = '<span>参考说明 Prompt <b>*</b></span><textarea id="imageReferencePrompt" placeholder="说明希望参考图片中的空间、布局、风格和必须保留的元素"></textarea><small>图片用于视觉参考；文字用于说明具体生成意图和约束。</small>';
imagePanel.appendChild(imagePromptField);
const imageUploadButton = imagePanel.querySelector('.ghost-btn');
const uploadState = document.createElement('small');
uploadState.className = 'upload-state';
uploadState.textContent = '尚未上传参考图';
imagePanel.querySelector('.upload-area').appendChild(uploadState);
imageUploadButton.addEventListener('click', () => {
  referenceUploaded = true;
  uploadState.textContent = '已选择参考图：space-reference.png';
  showToast('参考图已添加');
});
const promptFileInput = document.querySelector('#promptFileInput');
const promptFileState = document.querySelector('#promptFileState');
document.querySelector('#choosePromptFile').addEventListener('click', () => promptFileInput.click());
promptFileInput.addEventListener('change', async () => {
  const file = promptFileInput.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { promptFileInput.value = ''; showToast('提示词文件不能超过 10MB'); return; }
  importedPrompt = `已导入文件：${file.name}`;
  if (/\.(txt|md)$/i.test(file.name)) {
    try { importedPrompt = (await file.text()).trim() || importedPrompt; } catch { /* 原型中保留文件选择结果 */ }
  }
  promptFileState.textContent = `已选择：${file.name}`;
  showToast('提示词文件已添加');
});

const promptTextarea = document.querySelector('#promptText');
let originalPrompt = promptTextarea.value;
let rewrittenPrompt = '生成一个 4.0m × 3.5m、净高 2.7m 的现代卧室：东侧保留采光窗，西侧为入口门；布置双人床、衣柜、床头柜、双人沙发与台灯，并补充地毯、窗帘及小型收纳物。需保留床侧通行空间，避免门扇、窗区与家具碰撞。';
let usingRewrite = false;

function renderPromptState() {
  const button = document.querySelector('#rewriteBtn');
  const originalButton = document.querySelector('#viewOriginal');
  document.querySelector('#promptLabel').innerHTML = usingRewrite ? '当前生效 Prompt：AI 改写版本 <b>*</b>' : '原始 Prompt <b>*</b>';
  document.querySelector('#promptHint').textContent = usingRewrite ? 'AI 改写结果可继续编辑；还原原始 Prompt 不会丢失此版本。' : '建议包含空间类型、尺寸、门窗方位、必要物件及风格约束。';
  document.querySelector('#rewriteState').textContent = usingRewrite ? '当前使用 AI 改写版本；可继续编辑或查看原始输入。' : '将输入转为可执行的摆放设计，支持在生成前继续编辑。';
  button.innerHTML = usingRewrite ? '<svg><use href="#i-wand"></use></svg>还原原始 Prompt' : '<svg><use href="#i-wand"></use></svg>AI 改写';
  originalButton.classList.toggle('hidden', !usingRewrite);
}

document.querySelector('#rewriteBtn').addEventListener('click', () => {
  const activeTextarea = activePromptMode === 'image' ? document.querySelector('#imageReferencePrompt') : promptTextarea;
  if (usingRewrite) {
    rewrittenPrompt = activeTextarea.value;
    activeTextarea.value = originalPrompt;
    usingRewrite = false;
  } else {
    originalPrompt = activeTextarea.value;
    activeTextarea.value = rewrittenPrompt;
    usingRewrite = true;
  }
  document.querySelector('#promptCompare').classList.add('hidden');
  renderPromptState();
});
document.querySelector('#viewOriginal').addEventListener('click', () => {
  document.querySelector('#originalPromptPreview').textContent = originalPrompt;
  document.querySelector('#promptCompare').classList.toggle('hidden');
});
document.querySelector('#closeCompare').addEventListener('click', () => document.querySelector('#promptCompare').classList.add('hidden'));

document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  const quantity = document.querySelector('#quantity');
  const next = Math.max(1, Math.min(50, Number(quantity.value || 1) + Number(button.dataset.step)));
  quantity.value = next;
  updateSummary();
}));
document.querySelector('#quantity').addEventListener('input', updateSummary);

function updateSummary() {
  const quantity = Math.max(1, Math.min(50, Number(document.querySelector('#quantity').value || 1)));
  document.querySelector('#quantity').value = quantity;
  document.querySelector('.task-summary strong').textContent = `${processMode === 'auto' ? 'AI 自动筛选' : '人工筛选'} · ${quantity} 个场景`;
}
document.querySelectorAll('[data-process]').forEach((card) => card.addEventListener('click', () => {
  processMode = card.dataset.process;
  document.querySelectorAll('[data-process]').forEach((item) => item.classList.toggle('active', item === card));
  document.querySelector('#strategyNote span').textContent = processMode === 'auto'
    ? '开始生成后，系统将自动完成资产召回、筛选、布局与碰撞检测。'
    : '创建后将先进入召回结果页；确认组装物品池后，系统再批量组合与布局。';
  updateSummary();
}));

function insertTaskRow({ name, statusLabel, statusClass, progressLabel, progressHint, progress, action }) {
  const quantity = document.querySelector('#quantity').value;
  const modeLabel = processMode === 'auto' ? 'AI 自动筛选' : '人工筛选';
  taskRows.insertAdjacentHTML('afterbegin', `<tr data-updated="${Date.now()}"><td><strong>${name}</strong><code>G2S-20260916-00129</code></td><td><span class="env"><svg><use href="#i-box"></use></svg>${selectedEnvironment.name}</span><small>${selectedEnvironment.engine} · ${selectedEnvironment.size}</small></td><td>${modeLabel}</td><td><div class="progress"><span><b>${progressLabel || `0 / ${quantity}`}</b><em>${progressHint}</em></span><div><i style="width:${progress}"></i></div></div></td><td><span class="status ${statusClass}">${statusLabel}</span></td><td>刚刚</td><td class="updated-time">刚刚</td><td></td></tr>`);
  renderTaskActions();
}

document.querySelector('#saveDraft').addEventListener('click', () => {
  const name = document.querySelector('#taskName').value.trim();
  if (!name) { showToast('请先填写任务名称后再保存'); return; }
  insertTaskRow({ name, statusLabel: '草稿', statusClass: 'draft', progressLabel: '—', progressHint: '配置待完善', progress: '0%', action: '继续编辑' });
  closeModal();
  showToast('任务配置已保存，尚未开始生成');
});

document.querySelector('#startGenerate').addEventListener('click', () => {
  const name = document.querySelector('#taskName').value.trim();
  const prompt = activePromptMode === 'image'
    ? document.querySelector('#imageReferencePrompt').value.trim()
    : activePromptMode === 'import' ? importedPrompt : document.querySelector('#promptText').value.trim();
  if (!name || !prompt || (activePromptMode === 'image' && !referenceUploaded)) { showToast(activePromptMode === 'import' ? '请先选择提示词文件' : '请完善任务名称与当前输入方式的 Prompt；图文模式还需上传参考图'); return; }
  insertTaskRow(processMode === 'auto'
    ? { name, statusLabel: '生成中', statusClass: 'running', progressHint: '正在初始化任务', progress: '5%', action: '' }
    : { name, statusLabel: '待人工筛选', statusClass: 'action', progressLabel: '—', progressHint: '等待确认物品池', progress: '22%', action: '开始筛选' });
  closeModal();
  showToast(processMode === 'auto' ? '任务已创建，正在开始场景生成' : '任务已创建，请前往召回结果确认物品池');
});

const listPage = document.querySelector('.page');
const manualSelectionPage = document.querySelector('#manualSelectionPage');
const configOverlay = document.querySelector('#configOverlay');
const taskDetailPage = document.querySelector('#taskDetailPage');
const acceptanceWorkbench = document.querySelector('#acceptanceWorkbench');
let activeTaskDetailRow = null;
const terminalStatuses = new Set(['已完成', '已停止', '召回失败', '生成部分失败', '生成失败']);
function openManualSelection() {
  manualSelectionPage.classList.remove('hidden');
}
function closeManualSelection() {
  manualSelectionPage.classList.add('hidden');
}
function openConfig() { configOverlay.classList.remove('hidden'); }
function closeConfig() { configOverlay.classList.add('hidden'); }
function cloneTask() {
  taskDetailPage.classList.add('hidden');
  listPage.classList.remove('hidden');
  document.querySelector('#modalTitle').textContent = '克隆任务';
  openModal();
  showToast('已复制当前配置；保存或开始生成后将创建新的任务 ID');
}
const detailStatusConfigs = {
  '草稿': { stage: '配置草稿', stageSub: '仅保存配置，尚未开始', overview: '草稿待完善', overviewText: '当前任务尚未触发资产召回，可继续编辑配置或删除草稿。', outcome: '未生成结果', outcomeText: '开始生成后才会创建任务快照并进入资产召回或生成流程。', log: '暂无运行记录', logText: '草稿未启动，不产生运行日志。', timeline: 0 },
  '召回中': { stage: '资产召回', stageSub: '正在解析 Prompt 与召回候选资产', overview: '正在召回资产', overviewText: '系统正在解析输入约束、检索资产并计算相关性；完成后将进入人工筛选或自动组装。', outcome: '生成尚未开始', outcomeText: '等待资产召回完成后进入下一阶段。', log: '召回运行正常', logText: '当前未发现异常；如服务失败，将在此展示失败阶段、错误码与重试建议。', timeline: 1 },
  '待人工筛选': { stage: '资产召回与人工筛选', stageSub: '已召回候选资产，等待确认物品池', overview: '等待人工确认物品池', overviewText: '请确认必需资产与候选资产；确认后将固化本次任务的资产筛选结果并进入生成队列。', outcome: '尚未生成结果', outcomeText: '确认物品池并启动生成后，此处展示场景产物、质检结果与验收结论。', log: '暂无失败与运行记录', logText: '任务等待人工处理；运行后将记录各阶段的异常原因与可重试信息。', timeline: 1 },
  '生成排队中': { stage: '生成排队', stageSub: '已确认输入，等待计算资源', overview: '等待生成资源', overviewText: '物品池和任务配置已经固化，系统正在等待可用的生成资源。', outcome: '尚未生成结果', outcomeText: '资源调度完成后将开始组合、布局、物理模拟与渲染。', log: '队列运行正常', logText: '当前无异常；队列等待时长与资源调度策略【⚠️待技术确认】。', timeline: 2 },
  '生成中': { stage: '批量生成', stageSub: '正在组合、布局与物理校验', overview: '正在批量生成', overviewText: '系统正按物品池执行组合、布局、物理模拟与固定机位渲染。', outcome: '生成进行中', outcomeText: '已完成的场景将持续写入结果集，全部完成后自动进入质检。', log: '生成运行正常', logText: '当前无异常；单场景失败会记录至失败与运行记录。', timeline: 2 },
  '自动质检中': { stage: '自动质量检查', stageSub: '正在执行碰撞与可达性检查', overview: '正在自动质检', overviewText: '系统正在执行碰撞、物理稳定性、可达性和必需物品覆盖等检查。', outcome: '质检进行中', outcomeText: '质检完成后，可用结果将进入人工验收队列。', log: '质检运行正常', logText: '当前无异常；不通过项将写入对应场景的质量报告。', timeline: 2 },
  '待验收': { stage: '人工验收', stageSub: '自动质检完成，等待人工结论', overview: '等待人工验收', overviewText: '请对生成结果进行可用 / 不可用判定，并填写不可用原因。', outcome: '结果待验收', outcomeText: '生成及自动质检已完成，可从验收工作台查看 USD、图片与质量报告。', log: '运行完成，等待验收', logText: '运行阶段未发现阻断异常；验收结论将写入任务记录。', timeline: 3 },
  '已完成': { stage: '已完成', stageSub: '验收完成，结果可追溯', overview: '任务已完成', overviewText: '全部生成结果已处理，配置、物品池、质量结论和场景产物均可追溯。', outcome: '生成结果已完成', outcomeText: '可用与不可用结果以任务实际验收结论为准。', log: '任务运行完成', logText: '未发现需处理的异常；历史运行记录可用于复盘。', timeline: 4 },
  '已停止': { stage: '任务已停止', stageSub: '已生成结果被保留', overview: '任务已停止', overviewText: '任务由用户主动停止；已生成的场景产物和运行记录将被保留。', outcome: '结果已保留', outcomeText: '可对已有结果执行验收；若需补充批次，请克隆任务并重新生成。', log: '停止记录', logText: '已记录停止时间、当前阶段与已生成数量。', timeline: 2 },
  '召回失败': { stage: '召回失败', stageSub: 'Prompt 解析或资产检索未完成', overview: '资产召回失败', overviewText: '任务未获得可用候选资产，无法进入后续筛选或生成流程。', outcome: '未生成结果', outcomeText: '建议在详情中核对 Prompt、环境和可用资产范围后克隆任务重试。', log: '召回异常', logText: '失败原因与可重试建议由召回服务返回；错误码【⚠️待技术确认】。', timeline: 1 },
  '生成部分失败': { stage: '生成部分失败', stageSub: '保留可用结果，部分场景失败', overview: '部分场景生成失败', overviewText: '任务已产出部分可用结果；请进入验收确认有效产物，并基于失败原因决定是否重试。', outcome: '部分结果可用', outcomeText: '可用结果进入验收，失败样本需展示失败阶段和原因。', log: '存在生成异常', logText: '异常场景、失败阶段与错误码需可定位；重试粒度【⚠️待技术确认】。', timeline: 3 },
  '生成失败': { stage: '生成失败', stageSub: '未生成可用结果', overview: '批量生成失败', overviewText: '任务未产出可用场景，需要基于错误原因调整配置后克隆任务重新发起。', outcome: '未生成结果', outcomeText: '无可用生成产物；历史配置和运行日志仍可用于排查。', log: '生成异常', logText: '需展示失败阶段、用户可读原因、错误码和是否可重试。', timeline: 2 }
};
function renderDetailTimeline(currentStep) {
  const steps = [
    ['创建任务', '环境、Prompt 与生成策略已保存为任务配置快照。'],
    ['资产召回与筛选', '解析输入、召回候选资产，并按过程模式进行人工或自动筛选。'],
    ['批量生成与质检', '执行组合、布局、物理模拟、渲染和自动质量检查。'],
    ['人工验收', '对生成结果进行可用性确认并沉淀验收结论。'],
    ['完成 / 归档', '任务结果可追溯，并可进入后续场景资产管理。']
  ];
  document.querySelector('#detailTimeline').innerHTML = steps.map(([title, description], index) => {
    const state = index < currentStep ? 'done' : index === currentStep ? 'current' : '';
    const time = index === currentStep ? '<time>当前阶段</time>' : '';
    return `<li class="${state}"><span>${index + 1}</span><div><strong>${title}</strong><p>${description}</p>${time}</div></li>`;
  }).join('');
}
function openTaskDetail(row) {
  activeTaskDetailRow = row;
  const cells = row.children;
  const statusElement = row.querySelector('.status');
  const status = statusElement?.textContent.trim() || '';
  const config = detailStatusConfigs[status] || detailStatusConfigs['草稿'];
  const progressMetric = cells[3].querySelector('b')?.textContent.trim() || '—';
  const progressHint = cells[3].querySelector('em')?.textContent.trim() || '暂无阶段信息';
  const environmentName = cells[1].querySelector('.env')?.textContent.trim() || '—';
  const engine = cells[1].querySelector('small')?.textContent || '—';
  const process = cells[2].textContent.trim();
  const taskName = cells[0].querySelector('strong')?.textContent || '场景生成任务';
  const taskId = cells[0].querySelector('code')?.textContent || '—';
  const createdAt = cells[5].textContent.trim();
  document.querySelector('#taskDetailTitle').textContent = cells[0].querySelector('strong')?.textContent || '场景生成任务';
  document.querySelector('#detailTaskId').textContent = taskId;
  document.querySelector('#detailEnvironment').textContent = environmentName;
  document.querySelector('#detailEngine').textContent = engine;
  document.querySelector('#detailProcess').textContent = process;
  document.querySelector('#detailCreatedAt').textContent = createdAt;
  document.querySelector('#detailUpdatedAt').textContent = cells[6].textContent.trim();
  const detailStatus = document.querySelector('#detailStatus');
  detailStatus.textContent = status;
  detailStatus.className = statusElement?.className || 'status';
  const isManual = status === '待人工筛选';
  document.querySelector('#detailStartSelection').classList.toggle('hidden', !isManual);
  document.querySelector('#overviewStartSelection').classList.toggle('hidden', !isManual);
  document.querySelector('#detailCloneTask').classList.toggle('hidden', !terminalStatuses.has(status));
  document.querySelector('#detailEnterAcceptance').classList.toggle('hidden', !['待验收', '生成部分失败'].includes(status));
  document.querySelector('#detailStage').textContent = config.stage;
  document.querySelector('#detailStageSub').textContent = `${progressMetric} · ${progressHint}`;
  document.querySelector('#detailOverviewTitle').textContent = config.overview;
  document.querySelector('#detailOverviewDesc').textContent = config.overviewText;
  document.querySelector('#detailResultsTitle').textContent = config.outcome;
  document.querySelector('#detailResultsText').textContent = config.outcomeText;
  document.querySelector('#detailLogsTitle').textContent = config.log;
  document.querySelector('#detailLogsText').textContent = config.logText;
  document.querySelector('#detailSnapshotName').textContent = taskName;
  document.querySelector('#detailSnapshotId').textContent = taskId;
  document.querySelector('#detailSnapshotCreated').textContent = `陈建模 · ${createdAt}`;
  document.querySelector('#detailSnapshotEnvironment').textContent = environmentName;
  document.querySelector('#detailSnapshotEngine').textContent = engine;
  document.querySelector('#detailSnapshotProcess').textContent = process === '人工筛选' ? '人工筛选 + AI 随机组合' : 'AI 自动筛选 + 直接组装';
  document.querySelector('#detailSnapshotStatus').textContent = status;
  document.querySelector('#detailSnapshotProgress').textContent = `${progressMetric} · ${progressHint}`;
  document.querySelector('#detailSnapshotOutcome').textContent = config.outcome;
  renderDetailTimeline(config.timeline);
  taskDetailPage.classList.remove('hidden');
}
function closeTaskDetail() {
  taskDetailPage.classList.add('hidden');
}
const reviewViewOptions = ['左前 45°', '右后 45°', '顶视图', '平面图', '入口视图', '操作区视图', '正前视图', '正后视图', '左侧视图', '右侧视图', '左后 45°', '右前 45°', '仰视 / 支撑检查'];
const reviewSceneNames = ['厨房操作区', '厨房收纳区', '厨房操作台', '厨房动线', '餐厨过渡区'];
const reviewScenes = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1;
  const status = number <= 12 ? 'pending' : number <= 18 ? 'usable' : 'unusable';
  const risk = number === 2 || number === 7 ? 'failed' : [1, 4, 8, 11, 19].includes(number) ? 'risk' : 'pass';
  return { id: `Scene-${String(number).padStart(3, '0')}`, name: reviewSceneNames[index % reviewSceneNames.length], status, risk, assets: 5 + (index % 4), generatedAt: `今天 10:${String(5 + Math.floor(index / 2)).padStart(2, '0')}`, rejectOpen: false, reasons: [], archived: false };
});
let acceptanceView = 'focus';
let activeReviewSceneId = 'Scene-002';
let activeReviewFilter = 'all';
let reviewQuery = '';
let activeReviewSort = 'risk';
let archiveSelectionMode = false;
const selectedArchiveSceneIds = new Set();
let archiveSelectionPreviousState = null;
const rejectReasons = ['穿模 / 碰撞', '物理不稳定', '动线不可用', '必需物品缺失', '风格不符', '资产质量异常', '任务不符', '其他'];
function reviewCounters() {
  const usable = reviewScenes.filter((scene) => scene.status === 'usable').length;
  const unusable = reviewScenes.filter((scene) => scene.status === 'unusable').length;
  return { reviewed: usable + unusable, usable, unusable, pending: reviewScenes.length - usable - unusable };
}
function refreshReviewCounters() {
  const counters = reviewCounters();
  document.querySelector('#reviewedCount').textContent = `${counters.reviewed} / 20`;
  document.querySelector('#usableCount').textContent = counters.usable;
  document.querySelector('#unusableCount').textContent = counters.unusable;
  document.querySelector('#pendingCount').textContent = counters.pending;
}
function reviewStatusText(status) {
  return status === 'pending' ? '待验收' : status === 'usable' ? '人工可用' : '人工不可用';
}
function reviewQualityText(risk) {
  return risk === 'failed' ? '不通过' : risk === 'risk' ? '有风险' : '通过';
}
function getFilteredReviewScenes(forFocus = false) {
  if (archiveSelectionMode && !forFocus) {
    return reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived).sort((a, b) => a.id.localeCompare(b.id));
  }
  let scenes = reviewScenes.filter((scene) => {
    const matchesQuery = `${scene.id} ${scene.name}`.toLowerCase().includes(reviewQuery);
    if (!matchesQuery) return false;
    if (activeReviewFilter === 'pending') return scene.status === 'pending';
    if (activeReviewFilter === 'failed') return scene.risk === 'failed';
    if (activeReviewFilter === 'pass') return scene.risk === 'pass';
    return true;
  });
  if (forFocus) scenes = scenes.filter((scene) => scene.status === 'pending');
  const riskWeight = { failed: 0, risk: 1, pass: 2 };
  scenes.sort((a, b) => {
    if (activeReviewSort === 'generated') return a.id.localeCompare(b.id);
    if (activeReviewSort === 'updated') return b.id.localeCompare(a.id);
    return riskWeight[a.risk] - riskWeight[b.risk] || a.id.localeCompare(b.id);
  });
  return scenes;
}
function viewSlots(scene) {
  const initialViews = ['左前 45°', '右后 45°', '顶视图', '平面图', '入口视图'];
  return initialViews.map((view, viewIndex) => `<label class="scene-view-slot view-${viewIndex % 5}"><span class="scene-view-art" data-view="${view}"><i></i><b></b><em></em></span><select data-view-select aria-label="${scene.id} 视角 ${viewIndex + 1}">${reviewViewOptions.map((option) => `<option ${option === view ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`).join('');
}
function qualitySummary(scene, compact = false) {
  const reachabilityClass = scene.risk === 'failed' ? 'danger' : scene.risk === 'risk' ? 'warning' : 'success';
  const reachabilityText = scene.risk === 'failed' ? '不通过' : scene.risk === 'risk' ? '有风险' : '通过';
  if (compact) return `<div class="pool-quality"><span>碰撞 <b class="success">通过</b></span><span>可达性 <b class="${reachabilityClass}">${reachabilityText}</b></span><span>覆盖 <b>${scene.risk === 'failed' ? '3 / 4' : '4 / 4'}</b></span><span>Prompt <b>92%</b></span></div>`;
  return `<div class="quality-summary"><span>碰撞 / 穿模 <b class="success">通过</b></span><span>落地 / 支撑 <b class="success">通过</b></span><span>可达性 <b class="${reachabilityClass}">${reachabilityText}</b></span><span>必需资产 <b>${scene.risk === 'failed' ? '3 / 4' : '4 / 4'}</b></span><span>Prompt 命中 <b>92%</b></span><span>多样性风险 <b class="warning">低</b></span></div><div class="quality-note">${scene.risk === 'failed' ? '自动质检发现可达性与资产干涉问题，请人工核对后判定。' : scene.risk === 'risk' ? '自动质检存在风险项，标记可用时将进行二次确认。' : '自动质检通过，可直接进行人工验收。'}</div>`;
}
function rejectFields(scene, compact = false) {
  if (compact && !scene.rejectOpen) return '';
  return `<fieldset class="reject-checks"><legend>不可用原因（可多选）</legend>${rejectReasons.map((reason) => `<label><input type="checkbox" data-reject-reason value="${reason}" ${scene.reasons.includes(reason) ? 'checked' : ''}> ${reason}</label>`).join('')}</fieldset>${compact ? '<button class="text-btn pool-confirm-reject" data-mark-unusable>确认不可用</button>' : ''}`;
}
function focusReviewCard(scene, queue) {
  const queueIndex = Math.max(0, queue.findIndex((item) => item.id === scene.id));
  return `<article class="focus-review-card" data-scene-id="${scene.id}">
    <header class="focus-scene-head"><div><p class="review-queue">验收队列：第 ${queueIndex + 1} / ${queue.length} 条待验收 · 风险优先</p><h2>${scene.id} · ${scene.name}</h2><p>自动质检：<b class="${scene.risk === 'failed' ? 'danger' : scene.risk === 'risk' ? 'warning' : 'success'}">${reviewQualityText(scene.risk)}</b>${scene.risk === 'failed' ? ' · 71 分 · 2 项问题' : scene.risk === 'risk' ? ' · 1 项风险' : ' · 94 分'}　人工验收：${reviewStatusText(scene.status)}　生成时间：${scene.generatedAt} · 使用 ${scene.assets} 个资产 · USD 已生成 · PhysX</p></div><button class="ghost-btn" data-review-3d>进入 3D 漫游</button></header>
    <section class="scene-five-views"><h3>场景预览 · 5 个关键视角</h3><div class="scene-view-grid">${viewSlots(scene)}</div><p>每个位置均可独立切换至其他已渲染视角。</p></section>
    <div class="focus-bottom-row"><section class="scene-quality-info"><h3>质量信息</h3>${qualitySummary(scene)}<label class="card-review-note">验收备注<textarea placeholder="选填，记录验收判断依据"></textarea></label></section><section class="scene-review-action"><h3>人工验收</h3><div class="review-result-label">当前状态：<b>${reviewStatusText(scene.status)}</b></div>${rejectFields(scene)}</section></div>
    <footer class="focus-decision-footer"><span>${scene.risk === 'pass' ? '自动质检通过，可直接完成验收。' : '自动质检存在风险，标记可用时需要二次确认。'}</span><div><button class="ghost-btn" data-mark-unusable>标记不可用</button><button class="primary-btn" data-mark-usable>标记可用</button></div></footer>
  </article>`;
}
function poolReviewCards(scenes) {
  if (!scenes.length) return '<div class="review-empty">当前筛选条件下没有场景。</div>';
  return `<div class="scene-pool-grid">${scenes.map((scene, index) => `<article class="scene-pool-card" data-scene-id="${scene.id}"><header><div><h2>${scene.id} · ${scene.name}</h2><p>自动质检：<b class="${scene.risk === 'failed' ? 'danger' : scene.risk === 'risk' ? 'warning' : 'success'}">${reviewQualityText(scene.risk)}</b>${scene.risk === 'failed' ? ' · 2 项问题' : scene.risk === 'risk' ? ' · 1 项风险' : ''}</p></div><span class="manual-status ${scene.archived ? 'archived' : scene.status}">${scene.archived ? '已归档' : reviewStatusText(scene.status)}</span></header><div class="pool-previews"><button class="pool-thumb thumb-${index % 5}" data-open-focus aria-label="查看 ${scene.id} 顶视图"><span>顶视图</span><i></i><b></b><em></em></button><button class="pool-thumb plan thumb-${(index + 2) % 5}" data-open-focus aria-label="查看 ${scene.id} 平面图"><span>平面图</span><i></i><b></b><em></em></button></div><div class="pool-scene-meta"><span>资产 ${scene.assets}</span><span>USD 已生成</span><span>PhysX</span></div>${qualitySummary(scene, true)}<section class="pool-manual"><div class="pool-manual-top"><span>人工验收：<b>${reviewStatusText(scene.status)}</b></span>${scene.status === 'pending' ? `<div class="pool-actions"><button class="ghost-btn" data-open-reject>标记不可用</button><button class="primary-btn" data-mark-usable>标记可用</button></div>` : scene.status === 'usable' && !scene.archived && archiveSelectionMode ? `<label class="archive-select"><input type="checkbox" data-toggle-archive ${selectedArchiveSceneIds.has(scene.id) ? 'checked' : ''}> 选择归档</label>` : `<button class="text-btn" data-open-focus>查看复核</button>`}</div>${scene.status === 'pending' ? rejectFields(scene, true) : ''}</section></article>`).join('')}</div>`;
}
function archiveSelectionBanner(scenes) {
  return `<section class="archive-selection-banner"><div><strong>归档选择模式</strong><span>可选择 ${scenes.length} 个已验收可用场景 · 已选择 <b>${selectedArchiveSceneIds.size}</b> 个</span></div><div><button class="ghost-btn" data-select-all-archive>全选 ${scenes.length} 个场景</button><button class="text-btn" data-exit-archive-selection>退出选择模式</button></div></section>`;
}
function acceptanceCompletionPanel() {
  const counters = reviewCounters();
  const unarchivedUsable = reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived).length;
  const archived = reviewScenes.filter((scene) => scene.archived).length;
  if (!unarchivedUsable) return `<section class="acceptance-completion"><div class="completion-icon">✓</div><h2>人工验收与归档已完成</h2><p>共验收 ${counters.reviewed} 个场景 · 已归档 ${archived} 个可用场景 · 不可用 ${counters.unusable} 个</p><div><button class="ghost-btn" data-view-results>查看验收结果</button><button class="primary-btn" data-return-task-list>返回任务列表</button></div></section>`;
  return `<section class="acceptance-completion"><div class="completion-icon">✓</div><h2>人工验收已完成</h2><p>共验收 ${counters.reviewed} 个场景 · 可用 ${counters.usable} 个 · 不可用 ${counters.unusable} 个</p><small>${unarchivedUsable} 个可用场景尚未归档；可选择性归档，或确认后归档全部可用场景。</small><div><button class="ghost-btn" data-enter-archive-selection>选择可归档场景</button><button class="primary-btn" data-archive-all>归档全部可用场景（${unarchivedUsable}）</button></div><button class="text-btn" data-view-results>查看验收结果</button></section>`;
}
function renderReviewCards() {
  const root = document.querySelector('#sceneReviewCards');
  acceptanceWorkbench.classList.toggle('is-pool-view', acceptanceView === 'pool');
  acceptanceWorkbench.classList.toggle('archive-selection-mode', archiveSelectionMode);
  if (acceptanceView === 'pool') {
    const poolScenes = getFilteredReviewScenes();
    root.innerHTML = `${archiveSelectionMode ? archiveSelectionBanner(poolScenes) : ''}${poolReviewCards(poolScenes)}`;
  }
  else {
    const queue = getFilteredReviewScenes(true);
    let activeScene = queue.find((scene) => scene.id === activeReviewSceneId);
    if (!activeScene) activeScene = queue[0];
    activeReviewSceneId = activeScene?.id || '';
    root.innerHTML = activeScene ? focusReviewCard(activeScene, queue) : reviewCounters().pending === 0 ? acceptanceCompletionPanel() : '<div class="review-empty">当前筛选条件下没有待验收场景。请调整筛选条件或前往场景池查看验收结果。</div>';
  }
  const eligible = reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived);
  const selectButton = document.querySelector('#selectUsableScenes');
  const archiveButton = document.querySelector('#archiveScenes');
  selectButton.textContent = archiveSelectionMode ? '取消选择' : '选择可归档场景';
  archiveButton.textContent = archiveSelectionMode ? `归档已选 ${selectedArchiveSceneIds.size} 个场景` : `归档全部可用场景（${eligible.length}）`;
  refreshReviewCounters();
}
function openAcceptance(row) {
  const cells = row.children;
  const name = cells[0].querySelector('strong')?.textContent || '场景生成任务';
  const taskId = cells[0].querySelector('code')?.textContent || '—';
  const environment = cells[1].querySelector('.env')?.textContent.trim() || '—';
  const engine = cells[1].querySelector('small')?.textContent || '—';
  const status = row.querySelector('.status')?.textContent.trim() || '待验收';
  document.querySelector('#acceptanceTitle').textContent = `${name} · 人工验收`;
  document.querySelector('#acceptanceContext').textContent = `${taskId} · ${environment} · ${engine} · 目标生成 20 个场景`;
  document.querySelector('#acceptanceTaskStatus').textContent = status;
  acceptanceView = 'focus';
  activeReviewSceneId = reviewScenes.find((scene) => scene.id === 'Scene-002' && scene.status === 'pending')?.id || reviewScenes.find((scene) => scene.status === 'pending')?.id || '';
  document.querySelectorAll('[data-acceptance-view]').forEach((item) => item.classList.toggle('active', item.dataset.acceptanceView === 'focus'));
  acceptanceWorkbench.classList.remove('hidden');
  renderReviewCards();
}
function closeAcceptance() {
  archiveSelectionMode = false;
  selectedArchiveSceneIds.clear();
  archiveSelectionPreviousState = null;
  acceptanceWorkbench.classList.remove('archive-selection-mode');
  acceptanceWorkbench.classList.add('hidden');
}

document.querySelectorAll('[data-open-manual-selection]').forEach((button) => button.addEventListener('click', openManualSelection));
document.querySelector('#backToTaskList').addEventListener('click', closeManualSelection);
document.querySelector('#closeManualSelection').addEventListener('click', closeManualSelection);
manualSelectionPage.addEventListener('click', (event) => { if (event.target === manualSelectionPage) closeManualSelection(); });
document.querySelector('#openConfig').addEventListener('click', openConfig);
document.querySelector('#closeConfig').addEventListener('click', closeConfig);
configOverlay.addEventListener('click', (event) => { if (event.target === configOverlay) closeConfig(); });
document.querySelector('#returnToSelection').addEventListener('click', closeConfig);
document.querySelector('#backToTaskListFromDetail').addEventListener('click', closeTaskDetail);
document.querySelector('#closeTaskDetail').addEventListener('click', closeTaskDetail);
taskDetailPage.addEventListener('click', (event) => { if (event.target === taskDetailPage) closeTaskDetail(); });
document.querySelector('#detailStartSelection').addEventListener('click', openManualSelection);
document.querySelector('#overviewStartSelection').addEventListener('click', openManualSelection);
document.querySelector('#detailCloneTask').addEventListener('click', cloneTask);
document.querySelector('#detailEnterAcceptance').addEventListener('click', () => {
  if (!activeTaskDetailRow) return;
  closeTaskDetail();
  openAcceptance(activeTaskDetailRow);
});
document.querySelectorAll('[data-detail-tab]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-detail-tab]').forEach((tab) => tab.classList.toggle('active', tab === button));
  document.querySelectorAll('[data-detail-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.detailPanel !== button.dataset.detailTab));
}));
document.querySelectorAll('[data-edit-draft]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#modalTitle').textContent = '编辑场景生成任务';
  openModal();
}));
document.querySelector('#backToTaskListFromAcceptance').addEventListener('click', closeAcceptance);
document.querySelector('#closeAcceptance').addEventListener('click', closeAcceptance);
document.querySelectorAll('[data-acceptance-view]').forEach((button) => button.addEventListener('click', () => {
  acceptanceView = button.dataset.acceptanceView;
  document.querySelectorAll('[data-acceptance-view]').forEach((item) => item.classList.toggle('active', item === button));
  renderReviewCards();
}));
document.querySelectorAll('[data-review-filter]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-review-filter]').forEach((item) => item.classList.toggle('active', item === button));
  activeReviewFilter = button.dataset.reviewFilter;
  renderReviewCards();
}));
document.querySelector('#reviewSearch').addEventListener('input', (event) => {
  reviewQuery = event.target.value.trim().toLowerCase();
  renderReviewCards();
});
document.querySelector('#sceneReviewCards').addEventListener('click', (event) => {
  const card = event.target.closest('[data-scene-id]');
  if (!card) return;
  if (event.target.closest('[data-review-3d]')) { showToast('3D 漫游能力待接入；当前原型展示固定机位与质检证据'); return; }
  const scene = reviewScenes.find((item) => item.id === card.dataset.sceneId);
  if (event.target.closest('[data-open-focus]')) {
    if (archiveSelectionMode) { showToast('归档选择模式下请使用复选框；退出后可进入大图验收。'); return; }
    activeReviewSceneId = scene.id;
    acceptanceView = 'focus';
    document.querySelectorAll('[data-acceptance-view]').forEach((item) => item.classList.toggle('active', item.dataset.acceptanceView === 'focus'));
    renderReviewCards();
    return;
  }
  if (event.target.closest('[data-open-reject]')) { scene.rejectOpen = true; renderReviewCards(); return; }
  if (event.target.closest('[data-mark-unusable]')) {
    const reasons = [...card.querySelectorAll('.reject-checks input:checked')].map((input) => input.value);
    if (!reasons.length) { showToast('标记不可用前，请至少选择一个不可用原因'); return; }
    scene.status = 'unusable'; scene.reasons = reasons; scene.rejectOpen = false;
    const queue = getFilteredReviewScenes(true);
    const currentIndex = queue.findIndex((item) => item.id === scene.id);
    activeReviewSceneId = queue[currentIndex + 1]?.id || queue[currentIndex - 1]?.id || '';
    renderReviewCards(); showToast('已标记为不可用，已进入下一条待验收场景'); return;
  }
  if (event.target.closest('[data-mark-usable]')) {
    if (scene.risk !== 'pass' && !window.confirm('该场景存在自动质检风险，确认仍标记为可用吗？')) return;
    const queue = getFilteredReviewScenes(true);
    const currentIndex = queue.findIndex((item) => item.id === scene.id);
    scene.status = 'usable'; scene.rejectOpen = false;
    activeReviewSceneId = queue[currentIndex + 1]?.id || queue[currentIndex - 1]?.id || '';
    renderReviewCards(); showToast('已标记为可用，已进入下一条待验收场景');
  }
});
document.querySelector('#sceneReviewCards').addEventListener('click', (event) => {
  if (event.target.closest('[data-select-all-archive]')) {
    reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived).forEach((scene) => selectedArchiveSceneIds.add(scene.id));
    renderReviewCards();
  }
  if (event.target.closest('[data-exit-archive-selection]')) exitArchiveSelection();
});
document.querySelector('#sceneReviewCards').addEventListener('click', (event) => {
  if (event.target.closest('[data-enter-archive-selection]')) {
    acceptanceView = 'pool';
    document.querySelectorAll('[data-acceptance-view]').forEach((item) => item.classList.toggle('active', item.dataset.acceptanceView === 'pool'));
    enterArchiveSelection();
  }
  if (event.target.closest('[data-archive-all]')) archiveScenesByIds(reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived).map((scene) => scene.id));
  if (event.target.closest('[data-view-results]')) {
    acceptanceView = 'pool';
    document.querySelectorAll('[data-acceptance-view]').forEach((item) => item.classList.toggle('active', item.dataset.acceptanceView === 'pool'));
    renderReviewCards();
  }
  if (event.target.closest('[data-return-task-list]')) closeAcceptance();
});
document.querySelector('#sceneReviewCards').addEventListener('change', (event) => {
  if (event.target.matches('[data-view-select]')) {
    const slot = event.target.closest('.scene-view-slot');
    slot.querySelector('.scene-view-art').dataset.view = event.target.value;
    showToast(`已切换为${event.target.value}`);
  }
  if (event.target.matches('[data-reject-reason]')) {
    const scene = reviewScenes.find((item) => item.id === event.target.closest('[data-scene-id]').dataset.sceneId);
    scene.reasons = [...event.target.closest('.reject-checks').querySelectorAll('input:checked')].map((input) => input.value);
  }
  if (event.target.matches('[data-toggle-archive]')) {
    const sceneId = event.target.closest('[data-scene-id]').dataset.sceneId;
    if (event.target.checked) selectedArchiveSceneIds.add(sceneId);
    else selectedArchiveSceneIds.delete(sceneId);
    renderReviewCards();
  }
});
function enterArchiveSelection() {
  archiveSelectionPreviousState = { filter: activeReviewFilter, query: reviewQuery };
  archiveSelectionMode = true;
  selectedArchiveSceneIds.clear();
  activeReviewFilter = 'all';
  reviewQuery = '';
  document.querySelector('#reviewSearch').value = '';
  document.querySelectorAll('[data-review-filter]').forEach((item) => item.classList.toggle('active', item.dataset.reviewFilter === 'all'));
  renderReviewCards();
  showToast('已进入归档选择模式：请勾选需要归档的已验收可用场景');
}
function exitArchiveSelection() {
  archiveSelectionMode = false;
  selectedArchiveSceneIds.clear();
  if (archiveSelectionPreviousState) {
    activeReviewFilter = archiveSelectionPreviousState.filter;
    reviewQuery = archiveSelectionPreviousState.query;
    document.querySelector('#reviewSearch').value = reviewQuery;
    document.querySelectorAll('[data-review-filter]').forEach((item) => item.classList.toggle('active', item.dataset.reviewFilter === activeReviewFilter));
  }
  archiveSelectionPreviousState = null;
  renderReviewCards();
}
function archiveScenesByIds(ids) {
  if (!ids.length) { showToast('暂无可归档场景'); return; }
  if (!window.confirm(`将归档 ${ids.length} 个已验收可用场景。待验收和不可用场景不会受影响，确认继续吗？`)) return;
  reviewScenes.forEach((scene) => { if (ids.includes(scene.id)) scene.archived = true; });
  exitArchiveSelection();
  showToast(`已归档 ${ids.length} 个可用场景`);
}
document.querySelector('#selectUsableScenes').addEventListener('click', () => {
  if (archiveSelectionMode) exitArchiveSelection();
  else enterArchiveSelection();
});
document.querySelector('#archiveScenes').addEventListener('click', () => {
  const eligible = reviewScenes.filter((scene) => scene.status === 'usable' && !scene.archived);
  const ids = archiveSelectionMode ? [...selectedArchiveSceneIds] : eligible.map((scene) => scene.id);
  if (archiveSelectionMode && !ids.length) { showToast('请至少选择 1 个可归档场景'); return; }
  archiveScenesByIds(ids);
});
function renderTaskActions() {
  taskRows.querySelectorAll('tr').forEach((row) => {
    const status = row.querySelector('.status')?.textContent.trim();
    const actionCell = row.lastElementChild;
    const actions = {
      '草稿': [['任务详情', 'detail'], ['编辑', 'edit'], ['删除草稿', 'delete']],
      '召回中': [['任务详情', 'detail'], ['停止任务', 'stop']],
      '待人工筛选': [['任务详情', 'detail'], ['开始筛选', 'manual'], ['停止任务', 'stop']],
      '生成排队中': [['任务详情', 'detail'], ['停止任务', 'stop']],
      '生成中': [['任务详情', 'detail'], ['停止任务', 'stop']],
      '自动质检中': [['任务详情', 'detail'], ['停止任务', 'stop']],
      '待验收': [['任务详情', 'detail'], ['进入验收', 'review']],
      '已完成': [['任务详情', 'detail'], ['克隆任务', 'clone']],
      '已停止': [['任务详情', 'detail'], ['克隆任务', 'clone']],
      '召回失败': [['任务详情', 'detail'], ['克隆任务', 'clone']],
      '生成部分失败': [['任务详情', 'detail'], ['进入验收', 'review'], ['克隆任务', 'clone']],
      '生成失败': [['任务详情', 'detail'], ['克隆任务', 'clone']]
    }[status] || [];
    actionCell.innerHTML = `<div class="task-action-group">${actions.map(([label, action]) => `<button class="action-link" data-task-action="${action}">${label}</button>`).join('')}</div>`;
  });
}
taskRows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-task-action]');
  if (!button) return;
  const row = button.closest('tr');
  const action = button.dataset.taskAction;
  if (action === 'detail') openTaskDetail(row);
  else if (action === 'manual') openManualSelection();
  else if (action === 'review') openAcceptance(row);
  else if (action === 'config') openConfig();
  else if (action === 'clone') cloneTask();
  else if (action === 'edit') { document.querySelector('#modalTitle').textContent = '编辑场景生成任务'; openModal(); }
  else if (action === 'delete') showToast('删除草稿需二次确认');
  else if (action === 'stop') showToast('停止任务需二次确认；已生成结果将被保留');
  else if (action === 'archive') showToast('任务归档入口待接入');
  else showToast(`${button.textContent}入口待接入`);
});

const assetChecks = [...document.querySelectorAll('.asset-check')];
function refreshAssetPool() {
  const selected = assetChecks.filter((check) => check.checked);
  const required = selected.filter((check) => check.closest('.selection-asset').querySelector('.asset-role').value === '必需');
  const candidates = selected.filter((check) => check.closest('.selection-asset').querySelector('.asset-role').value === '候选');
  document.querySelectorAll('.selection-asset').forEach((row) => row.classList.toggle('is-selected', row.querySelector('.asset-check').checked));
  document.querySelector('#selectedAssetCount').textContent = selected.length;
  document.querySelector('#poolCount').textContent = `已选 ${selected.length} 项`;
  document.querySelector('#requiredCount').textContent = required.length;
  document.querySelector('#candidateCount').textContent = candidates.length;
  document.querySelector('#requiredPool').innerHTML = required.map((check) => `<div class="pool-item">${check.dataset.name}</div>`).join('') || '<small>尚未设置必需资产</small>';
  document.querySelector('#candidatePool').innerHTML = candidates.map((check) => `<div class="pool-item">${check.dataset.name}</div>`).join('') || '<small>尚未选择候选资产</small>';
}
assetChecks.forEach((check) => check.addEventListener('change', refreshAssetPool));
document.querySelectorAll('.asset-role').forEach((select) => select.addEventListener('change', refreshAssetPool));
function filterAssets(keyword) {
  document.querySelectorAll('.selection-asset').forEach((row) => { row.hidden = !row.dataset.search.includes(keyword.trim()); });
}
document.querySelector('#assetSearch').addEventListener('input', (event) => { document.querySelector('#assetSearchTop').value = event.target.value; filterAssets(event.target.value); });
document.querySelector('#assetSearchTop').addEventListener('input', (event) => { document.querySelector('#assetSearch').value = event.target.value; filterAssets(event.target.value); });
document.querySelector('#resetAssetFilter').addEventListener('click', () => { document.querySelector('#assetSearch').value = ''; document.querySelector('#assetSearchTop').value = ''; filterAssets(''); });
document.querySelector('#saveSelection').addEventListener('click', () => showToast('筛选结果已保存，任务仍处于待人工筛选'));
document.querySelector('#confirmSelection').addEventListener('click', () => {
  const required = assetChecks.filter((check) => check.checked && check.closest('.selection-asset').querySelector('.asset-role').value === '必需');
  const candidates = assetChecks.filter((check) => check.checked && check.closest('.selection-asset').querySelector('.asset-role').value === '候选');
  if (!required.length || !candidates.length) { showToast('请至少保留 1 个必需资产和 1 个候选资产'); return; }
  showToast('物品池已确认，任务进入生成排队中');
  closeManualSelection();
});
refreshAssetPool();
renderTaskActions();

const updatedLabels = ['今天 10:43', '今天 10:36', '今天 10:23', '今天 10:11', '今天 10:02', '今天 09:47', '昨天 17:06', '09-13 18:20', '09-13 15:14', '09-12 14:29', '09-12 11:08', '09-11 17:39'];
function initializeUpdatedTimes() {
  [...taskRows.querySelectorAll('tr')].forEach((row, index) => {
    row.dataset.updated = String(updatedLabels.length - index);
    if (!row.querySelector('.updated-time')) {
      const cell = document.createElement('td');
      cell.className = 'updated-time';
      cell.textContent = updatedLabels[index] || '—';
      row.insertBefore(cell, row.lastElementChild);
    }
  });
}
function sortTaskRows(direction) {
  const rows = [...taskRows.querySelectorAll('tr')];
  rows.sort((a, b) => direction === 'asc' ? Number(a.dataset.updated) - Number(b.dataset.updated) : Number(b.dataset.updated) - Number(a.dataset.updated));
  rows.forEach((row) => taskRows.appendChild(row));
}
initializeUpdatedTimes();
document.querySelector('#updatedSort').addEventListener('change', (event) => sortTaskRows(event.target.value));

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal(); closeEnvironmentPicker(); closeConfig(); closeTaskDetail(); closeAcceptance(); } });
