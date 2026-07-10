// Trang quản lý kho tài liệu Copilot (spec 003 US1). Chunk được tính sẵn khi lưu.
import { putDocSet, listDocSets, deleteDocSet, putDoc, listDocs, deleteDoc } from '../lib/db.js';
import { chunkText } from '../lib/retrieval.js';
import { verifyLicense, PROD_PUBLIC_KEY } from '../lib/license.js';
import { assessAddition, canImportFile, FREE_TOTAL_CHARS, PRO_FILE_EXTENSIONS } from '../lib/doc-limits.js';
import { extractText } from '../lib/doc-import.js';
import { uid } from '../lib/format.js';

const $ = (id) => document.getElementById(id);
let currentSet = null;
let isPro = false;

// D6: free cũng dùng Copilot — giới hạn TỔNG kho FREE_TOTAL_CHARS ký tự, chỉ dán text.
async function totalChars() {
  let sum = 0;
  for (const ds of await listDocSets()) {
    for (const d of await listDocs(ds.id)) sum += d.content?.length || 0;
  }
  return sum;
}

async function refreshTierInfo() {
  const el = $('tier-info');
  if (isPro) {
    el.textContent = `⭐ Pro — không giới hạn ký tự; nhập file: ${PRO_FILE_EXTENSIONS.map((e) => '.' + e).join(' ')} (PDF/DOCX sắp có). Mọi convert chạy trên máy bạn.`;
  } else {
    const used = await totalChars();
    el.textContent = `Bản Free: dán text, tổng kho ${used.toLocaleString('vi')} / ${FREE_TOTAL_CHARS.toLocaleString('vi')} ký tự. Nâng Pro để nhập file và bỏ giới hạn.`;
  }
}

init();

async function init() {
  const { license, licensePubKey } = await chrome.storage.local.get(['license', 'licensePubKey']);
  isPro = !!(license?.key && (await verifyLicense(license.key, licensePubKey || PROD_PUBLIC_KEY)).valid);
  await refreshTierInfo();
  $('file-import-label').hidden = !isPro;
  $('doc-files').setAttribute('accept', PRO_FILE_EXTENSIONS.map((e) => '.' + e).join(','));
  $('doc-files').addEventListener('change', importFiles);

  $('add-docset').addEventListener('click', async () => {
    const name = $('new-docset').value.trim();
    if (!name) return;
    const ds = { id: uid(), name, createdAt: Date.now() };
    await putDocSet(ds);
    $('new-docset').value = '';
    await renderSets();
    openSet(ds);
  });

  $('add-doc').addEventListener('click', async () => {
    const title = $('doc-title').value.trim() || 'Tài liệu';
    const content = $('doc-content').value.trim();
    if (!content || !currentSet) return;
    if (!(await addDocChecked(title, content))) return;
    $('doc-title').value = '';
    $('doc-content').value = '';
  });

  $('delete-docset').addEventListener('click', async () => {
    if (!currentSet || !confirm(`Xóa vĩnh viễn bộ "${currentSet.name}" và toàn bộ tài liệu trong đó?`)) return;
    await deleteDocSet(currentSet.id);
    currentSet = null;
    $('doc-pane').hidden = true;
    await renderSets();
  });

  await renderSets();
}

// Thêm tài liệu qua cổng giới hạn tier (D6)
async function addDocChecked(title, content) {
  const verdict = assessAddition({
    isPro,
    existingChars: await totalChars(),
    additionChars: content.length,
  });
  const msg = $('limit-msg');
  if (!verdict.allowed) {
    msg.hidden = false;
    msg.textContent = `Bản Free còn ${verdict.remaining.toLocaleString('vi')} ký tự (kho tối đa ${FREE_TOTAL_CHARS.toLocaleString('vi')}). Rút gọn nội dung hoặc nâng Pro để bỏ giới hạn.`;
    return false;
  }
  msg.hidden = true;
  const chunks = chunkText(content).map((c) => ({ ...c, docTitle: title }));
  await putDoc({ id: uid(), docsetId: currentSet.id, title, content, chunks, addedAt: Date.now() });
  await renderDocs();
  await renderSets();
  await refreshTierInfo();
  return true;
}

// Pro: nhập file text-format, extract LOCAL (lib/doc-import.js — không gửi đi đâu)
async function importFiles(e) {
  const msg = $('limit-msg');
  for (const file of e.target.files || []) {
    const check = canImportFile(file.name, isPro);
    if (!check.allowed) {
      msg.hidden = false;
      msg.textContent = check.reason === 'pro-only'
        ? 'Nhập file là tính năng Pro.'
        : `Định dạng chưa hỗ trợ: ${file.name} (PDF/DOCX sắp có — hiện hỗ trợ ${PRO_FILE_EXTENSIONS.join(', ')}).`;
      continue;
    }
    const text = extractText(file.name, await file.text());
    if (text) await addDocChecked(file.name.replace(/\.[^.]+$/, ''), text);
  }
  e.target.value = '';
}

async function renderSets() {
  const sets = await listDocSets();
  const ul = $('docsets');
  ul.innerHTML = '';
  for (const ds of sets) {
    const docs = await listDocs(ds.id);
    const li = document.createElement('li');
    li.className = ds.id === currentSet?.id ? 'active' : '';
    li.innerHTML = `<span></span><span class="meta">${docs.length} tài liệu</span>`;
    li.querySelector('span').textContent = ds.name;
    li.addEventListener('click', () => openSet(ds));
    ul.appendChild(li);
  }
}

async function openSet(ds) {
  currentSet = ds;
  $('doc-pane').hidden = false;
  $('docset-title').textContent = ds.name;
  await renderSets();
  await renderDocs();
}

async function renderDocs() {
  const docs = await listDocs(currentSet.id);
  const ul = $('docs');
  ul.innerHTML = '';
  for (const d of docs) {
    const li = document.createElement('li');
    li.innerHTML = `<span></span><span class="meta">${d.chunks?.length || 0} đoạn · ${Math.round((d.content?.length || 0) / 1000)}k ký tự</span><button title="Xóa">🗑</button>`;
    li.querySelector('span').textContent = d.title;
    li.querySelector('button').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Xóa "${d.title}"?`)) return;
      await deleteDoc(d.id);
      await renderDocs();
      await renderSets();
    });
    ul.appendChild(li);
  }
}
