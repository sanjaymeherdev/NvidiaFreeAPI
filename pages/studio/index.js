import { useState } from 'react';
import { useRouter } from 'next/router';

const MODES = [
  { id: 'excel', name: 'Excel', icon: '📊', description: 'Create spreadsheets and data tables' },
  { id: 'doc', name: 'Word', icon: '📝', description: 'Generate Word documents' },
  { id: 'ppt', name: 'PowerPoint', icon: '📽️', description: 'Create presentations' },
  { id: 'pdf', name: 'PDF', icon: '📄', description: 'Generate PDF documents' },
  { id: 'csv', name: 'CSV', icon: '📋', description: 'Work with CSV data files' },
  { id: 'github', name: 'GitHub Code', icon: '💻', description: 'Edit code via GitHub PRs' }
];

export default function StudioIndex() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Choose Your Task</h1>
      <p style={styles.subtitle}>Select a mode to start working</p>
      
      <div style={styles.grid}>
        {MODES.map((mode) => (
          <div 
            key={mode.id} 
            style={styles.card}
            onClick={() => router.push(`/studio/${mode.id}`)}
          >
            <div style={styles.icon}>{mode.icon}</div>
            <h3 style={styles.cardTitle}>{mode.name}</h3>
            <p style={styles.description}>{mode.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0c10',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#eef2f9',
    marginBottom: '8px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#8896b0',
    marginBottom: '40px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    width: '100%'
  },
  card: {
    background: 'rgba(18, 22, 28, 0.9)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '24px',
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#eef2f9',
    marginBottom: '8px'
  },
  description: {
    fontSize: '14px',
    color: '#8896b0'
  }
};
