import type { CopilotChatConfig } from './config'
import { DEFAULT_CONFIG } from './config'
import { initChat, type ChatHandle } from './chat'

const CHAT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
const REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`

function headerButton(innerHTML: string, ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.innerHTML = innerHTML
  btn.setAttribute('aria-label', ariaLabel)
  Object.assign(btn.style, {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
  })
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.15)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
  return btn
}

export function createBubble(container: HTMLElement, config: CopilotChatConfig): void {
  const c = { ...DEFAULT_CONFIG, ...config }

  // Wrapper — fixed position, holds bubble + panel
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-copilot-chat', 'root')
  Object.assign(wrapper.style, {
    position: 'fixed',
    [c.position === 'bottom-left' ? 'left' : 'right']: '20px',
    bottom: '20px',
    zIndex: String(c.zIndex),
    fontFamily: `'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  })

  // Panel
  const panel = document.createElement('div')
  Object.assign(panel.style, {
    display: 'none',
    flexDirection: 'column',
    width: c.panelWidth,
    height: c.panelHeight,
    maxHeight: 'calc(100vh - 120px)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    background: '#fff',
  })

  // Header
  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: c.headerColor,
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: '0',
  })

  const title = document.createElement('span')
  title.textContent = c.headerTitle!

  const headerActions = document.createElement('div')
  Object.assign(headerActions.style, { display: 'flex', gap: '4px', alignItems: 'center' })

  const refreshBtn = headerButton(REFRESH_ICON, 'New conversation')
  const closeBtn = headerButton(CLOSE_ICON, 'Close chat')

  headerActions.append(refreshBtn, closeBtn)
  header.append(title, headerActions)

  // Status bar
  const statusBar = document.createElement('div')
  Object.assign(statusBar.style, {
    display: 'none',
    padding: '8px 16px',
    fontSize: '12px',
    color: '#666',
    background: '#f8f8f8',
    borderBottom: '1px solid #eee',
    flexShrink: '0',
  })

  // WebChat container
  const webchatContainer = document.createElement('div')
  Object.assign(webchatContainer.style, {
    flex: '1',
    overflow: 'hidden',
    minHeight: '0',
  })

  panel.append(header, statusBar, webchatContainer)

  // Bubble button
  const bubble = document.createElement('button')
  bubble.innerHTML = CHAT_ICON
  bubble.setAttribute('aria-label', 'Open chat')
  Object.assign(bubble.style, {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: c.bubbleColor,
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  })
  bubble.addEventListener('mouseenter', () => {
    bubble.style.transform = 'scale(1.05)'
    bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
  })
  bubble.addEventListener('mouseleave', () => {
    bubble.style.transform = 'scale(1)'
    bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
  })

  wrapper.append(panel, bubble)
  container.appendChild(wrapper)

  // State
  let isOpen = false
  let chatHandle: ChatHandle | null = null

  const statusMessages: Record<string, string> = {
    authenticating: 'Signing in...',
    connecting: 'Connecting to agent...',
    rendering: 'Loading chat...',
    connected: '',
    error: '',
  }

  function onStatus(status: string) {
    statusBar.textContent = statusMessages[status] || status
    if (status === 'connected') {
      statusBar.style.display = 'none'
      const child = webchatContainer.firstElementChild as HTMLElement | null
      if (child) child.style.height = '100%'
    }
  }

  function startChat() {
    statusBar.style.display = 'block'
    statusBar.style.color = '#666'
    statusBar.textContent = 'Connecting...'

    initChat(webchatContainer, config, onStatus)
      .then((handle) => {
        chatHandle = handle
      })
      .catch((err: Error) => {
        console.error('CopilotChat: initialization failed', err)
        statusBar.textContent = `Error: ${err.message}`
        statusBar.style.color = '#d32f2f'
      })
  }

  function toggle() {
    isOpen = !isOpen
    panel.style.display = isOpen ? 'flex' : 'none'
    bubble.style.display = isOpen ? 'none' : 'flex'

    if (isOpen && !chatHandle) {
      startChat()
    }
  }

  function refreshConversation() {
    if (!chatHandle) return
    statusBar.style.display = 'block'
    statusBar.style.color = '#666'
    statusBar.textContent = 'Starting new conversation...'

    chatHandle.refresh()
      .then(() => {
        statusBar.style.display = 'none'
      })
      .catch((err: Error) => {
        console.error('CopilotChat: refresh failed', err)
        statusBar.textContent = `Error: ${err.message}`
        statusBar.style.color = '#d32f2f'
      })
  }

  bubble.addEventListener('click', toggle)
  closeBtn.addEventListener('click', toggle)
  refreshBtn.addEventListener('click', refreshConversation)
}
