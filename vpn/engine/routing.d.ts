export = api;
declare const api: Readonly<{
    createFixedConfig: (host: any, port: any, split?: {}, options?: {}) => {
        mode: string;
        rules: {
            singleProxy: {
                scheme: any;
                host: any;
                port: any;
            };
            bypassList: any[];
        };
    };
    createPacScript: (config: any, excludedLocal?: string[]) => {
        mode: string;
        pacScript: {
            data: string;
        };
    };
    usesVpn: (url: any, policy: any) => any;
}>;
