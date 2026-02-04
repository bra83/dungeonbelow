/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ViewMode } from '../types';

// URL Logos
const LOGO_LIGHT = "https://raw.githubusercontent.com/bra83/lootnivel40/5b4cc708c07db4ba85cf89743e2b70fd73a704ef/logo-light.png";
const LOGO_DARK = "https://raw.githubusercontent.com/bra83/lootnivel40/5b4cc708c07db4ba85cf89743e2b70fd73a704ef/logo-dark.png";

interface NavigationProps {
    currentView: ViewMode;
    setView: (view: ViewMode) => void;
    toggleTheme: () => void;
    isDarkMode: boolean;
}

const NavItem = ({ view, label, icon, current, onClick }: any) => (
    <button 
        className={`nav-item ${current === view ? 'active' : ''}`}
        onClick={() => onClick(view)}
        aria-label={label}
    >
        {icon}
        <span className="nav-label">{label}</span>
    </button>
);

const Navigation = ({ currentView, setView, toggleTheme, isDarkMode }: NavigationProps) => {
    return (
        <div className="app-sidebar">
            {/* Desktop Logo Area */}
            <div className="sidebar-logo-container">
                 <img 
                    src={isDarkMode ? LOGO_DARK : LOGO_LIGHT} 
                    alt="Dungeon Below" 
                    className="app-logo-sidebar" 
                />
            </div>

            <nav className="nav-list">
                <NavItem 
                    view="dashboard" 
                    label="Home" 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>}
                />
                <NavItem 
                    view="filaments" 
                    label="Filam." 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>}
                />
                <NavItem 
                    view="quotes" 
                    label="Orçam." 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>}
                />
                <NavItem 
                    view="clients" 
                    label="Clients" 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>}
                />
                <NavItem 
                    view="extract" 
                    label="Extrato" 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>}
                />
                <NavItem 
                    view="calculator" 
                    label="Config" 
                    current={currentView} 
                    onClick={setView}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>}
                />
                
                {/* Theme Toggle Button */}
                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                    <button 
                        className="nav-item theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Alternar Tema"
                    >
                        {isDarkMode ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                        )}
                        <span className="nav-label">Tema</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default Navigation;