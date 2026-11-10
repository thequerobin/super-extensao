interface Window {
	SuperPreferences: {
		locale: {
			get(): Promise<'en' | 'pt-BR'>;
			watch(callback: (locale: 'en' | 'pt-BR') => void): () => void;
		};
		theme: {
			set(value: 'dark' | 'light' | 'system'): Promise<void>;
		};
		watchTheme(callback: (theme: 'dark' | 'light' | 'system', resolved: 'dark' | 'light') => void): () => void;
	};
}
