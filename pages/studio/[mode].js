import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const MODE_NAMES = {
  excel: 'Excel',
  doc: 'Word',
  ppt: 'PowerPoint',
  pdf: 'PDF',
  csv: 'CSV',
  github: 'GitHub Code'
};

export default function StudioMode() {
  const router = useRouter();
  const { mode } = router.query;
  
  const [mainMessages, setMainMessages] = useState([]);
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [mainInput, setMainInput] = useState('');
  const [assistantInput, setAssistantInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileContents, setFileContents] = useState({});
  
  const mainMessagesRef = useRef(mainMessages);
  const assistantMessagesRef = useRef(assistantMessages);
  
  useEffect(() => {
    mainMessagesRef.current = mainMessages;
  }, [mainMessages]);
  
  useEffect(() => {
    assistantMessagesRef.current = assistantMessages;
  }, [assistantMessages]);

  const ALLOWED_EXTENSIONS = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'csv', 'html', 'css', 'xml', 'yaml', 'yml', 'sql', 'sh', 'bash'];

  const validateAndReadFile = async (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const isTextLike = mime.startsWith('text/') || ALLOWED_EXTENSIONS.includes(ext);

    if (!isTextLike || !ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`File "${file.name}" is not allowed. Only text-based files are accepted.`);
    }

    const content = await readFileAsText(file);
    return { file, ext, content };
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);

    for (const file of uploadedFiles) {
      try {
        const { ext, content } = await validateAndReadFile(file);
        setFiles(prev => [...prev, { name: file.name, size: file.size, type: ext }]);
        setFileContents(prev => ({ ...prev, [file.name]: content }));

        const fileMessage = `I've uploaded a file: ${file.name}\n\nContent:\n${content}`;
        await sendToAssistant(fileMessage);
      } catch (error) {
        alert(error.message);
      }
    }

    e.target.value = '';
  };
  
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const sendToMain = async () => {
    if (!mainInput.trim() || isLoading) return;
    
    const userMessage = { role: 'user', content: mainInput };
    setMainMessages(prev => [...prev, userMessage]);
    setMainInput('');
    setIsLoading(true);
    
    try {
      const allMessages = [
        { role: 'system', content: `You are an AI assistant for generating ${MODE_NAMES[mode]} files. Always respond with structured JSON that can be converted to a ${MODE_NAMES[mode]} file. Include relevant fields like headers, rows, title, content, slides, etc.` },
        ...mainMessagesRef.current,
        userMessage
      ];
      
      const res = await fetch('/api/studio/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages })
      });
      
      if (!res.ok) throw new Error('Failed to get response');
      
      const data = await res.json();
      const assistantMessage = { role: 'assistant', content: data.content };
      
      setMainMessages(prev => [...prev, assistantMessage]);
      
      // Try to parse and generate file
      try {
        const jsonData = JSON.parse(data.content);
        await generateFile(jsonData);
      } catch (e) {
        console.log('Response is not JSON, showing as text');
      }
    } catch (error) {
      setMainMessages(prev => [...prev, { role: 'error', content: error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendToAssistant = async (message = assistantInput) => {
    if (!message.trim() || isAssistantLoading) return;
    
    if (message === assistantInput) {
      setAssistantMessages(prev => [...prev, { role: 'user', content: message }]);
      setAssistantInput('');
    }
    
    setIsAssistantLoading(true);
    
    try {
      const combinedContext = [
        { role: 'system', content: `You are a helpful assistant. You have access to both the main chat context and can help with general questions about ${MODE_NAMES[mode]} generation.` },
        ...mainMessagesRef.current,
        ...assistantMessagesRef.current,
        ...(message !== assistantInput ? [{ role: 'user', content: message }] : [])
      ];
      
      const res = await fetch('/api/studio/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: combinedContext })
      });
      
      if (!res.ok) throw new Error('Failed to get response');
      
      const data = await res.json();
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      setAssistantMessages(prev => [...prev, { role: 'error', content: error.message }]);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const generateFile = async (data) => {
    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data })
      });
      
      if (!res.ok) throw new Error('Failed to generate file');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const extension = mode === 'excel' ? 'xlsx' : mode === 'ppt' ? 'pptx' : mode === 'doc' ? 'docx' : mode;
      a.download = `output.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setMainMessages(prev => [...prev, { role: 'system', content: `✅ File generated successfully!` }]);
    } catch (error) {
      setMainMessages(prev => [...prev, { role: 'error', content: `Generation failed: ${error.message}` }]);
    }
  };

  if (!mode) {
    return <div style={styles.container}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => router.push('/studio')} style={styles.backBtn}>← Back</button>
        <h1 style={styles.title}>{MODE_NAMES[mode]} Studio</h1>
        <div style={styles.fileUpload}>
          <input 
            type="file" 
            multiple 
            onChange={handleFileUpload} 
            accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.csv,.html,.css,.xml,.yaml,.yml,.sql,.sh,.bash"
            style={styles.fileInput}
            title="Select a text-based source file"
          />
        </div>
      </header>
      
      {files.length > 0 && (
        <div style={styles.fileList}>
          <strong>Uploaded files:</strong>
          {files.map((f, i) => (
            <span key={i} style={styles.fileTag}>{f.name}</span>
          ))}
        </div>
      )}
      
      <div style={styles.panels}>
        {/* Main Chat - Fixed Output */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>📤 Main Chat (Generates Files)</h2>
          </div>
          <div style={styles.messages}>
            {mainMessages.map((msg, i) => (
              <div key={i} style={{...styles.msg, ...styles[`msg_${msg.role}`]}}>
                {msg.content}
              </div>
            ))}
            {isLoading && <div style={styles.loading}>Generating...</div>}
          </div>
          <div style={styles.inputRow}>
            <textarea
              value={mainInput}
              onChange={(e) => setMainInput(e.target.value)}
              placeholder="Describe what you want to generate..."
              style={styles.textarea}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToMain(); }}}
            />
            <button onClick={sendToMain} disabled={isLoading} style={styles.sendBtn}>Send</button>
          </div>
        </div>
        
        {/* Mini Assistant - Plain Text */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>💬 Mini Assistant (Chat)</h2>
          </div>
          <div style={styles.messages}>
            {assistantMessages.map((msg, i) => (
              <div key={i} style={{...styles.msg, ...styles[`msg_${msg.role}`]}}>
                {msg.content}
              </div>
            ))}
            {isAssistantLoading && <div style={styles.loading}>Thinking...</div>}
          </div>
          <div style={styles.inputRow}>
            <textarea
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              placeholder="Ask anything..."
              style={styles.textarea}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAssistant(); }}}
            />
            <button onClick={() => sendToAssistant()} disabled={isAssistantLoading} style={styles.sendBtn}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0c10',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  backBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#eef2f9',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#eef2f9',
    margin: 0
  },
  fileUpload: {
    marginLeft: 'auto'
  },
  fileInput: {
    color: '#8896b0',
    fontSize: '13px'
  },
  fileList: {
    padding: '12px 24px',
    background: 'rgba(124,92,252,0.1)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  fileTag: {
    background: 'rgba(124,92,252,0.3)',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#cdbfff'
  },
  panels: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1px',
    background: 'rgba(255,255,255,0.06)'
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0c10'
  },
  panelHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#eef2f9',
    margin: 0
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  msg: {
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: 1.5,
    maxWidth: '85%',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word'
  },
  msg_user: {
    alignSelf: 'flex-end',
    background: '#7c5cfc',
    color: 'white'
  },
  msg_assistant: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.06)',
    color: '#eef2f9'
  },
  msg_error: {
    alignSelf: 'center',
    background: 'rgba(255,80,80,0.12)',
    color: '#ff8a8a',
    border: '1px solid rgba(255,80,80,0.3)'
  },
  msg_system: {
    alignSelf: 'center',
    background: 'rgba(76,175,80,0.12)',
    color: '#80cbc4',
    border: '1px solid rgba(76,175,80,0.3)'
  },
  loading: {
    alignSelf: 'center',
    color: '#8896b0',
    fontSize: '13px'
  },
  inputRow: {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    gap: '10px'
  },
  textarea: {
    flex: 1,
    resize: 'none',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#eef2f9',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    minHeight: '60px'
  },
  sendBtn: {
    background: '#7c5cfc',
    border: 'none',
    color: 'white',
    borderRadius: '10px',
    padding: '0 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
