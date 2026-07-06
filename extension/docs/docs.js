// Trang quản lý kho tài liệu Copilot (spec 003 US1). Chunk được tính sẵn khi lưu.
import { putDocSet, listDocSets, deleteDocSet, putDoc, listDocs, deleteDoc } from '../lib/db.js';
import { chunkText } from '../lib/retrieval.js';
import { verifyLicense, PROD_PUBLIC_KEY } from '../lib/license.js';
import { uid } from '../lib/format.js';

const $ = (id) => document.getElementById(id);
let currentSet = null;

init();

async function init() {
  const { license, licensePubKey } = await chrome.storage.local.get(['license', 'licensePubKey']);
  const pro = license?.key && (await verifyLicense(license.key, licensePubKey || PROD_PUBLIC_KEY)).valid;
  $('pro-banner').hidden = !!pro;

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
    const chunks = chunkText(content).map((c) => ({ ...c, docTitle: title }));
    await putDoc({ id: uid(), docsetId: currentSet.id, title, content, chunks, addedAt: Date.now() });
    $('doc-title').value = '';
    $('doc-content').value = '';
    await renderDocs();
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
