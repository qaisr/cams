export interface GroupConfig {
    displayName: string;
    description: string;
    permissions: string[];
}
export interface RbacConfig {
    $schema: string;
    title: string;
    description?: string;
    version: string;
    lastUpdated?: string;
    groups: Record<string, GroupConfig>;
}
export declare function loadRbacConfig(): RbacConfig;
export declare function resetRbacConfigCache(): void;
//# sourceMappingURL=rbac-config.d.ts.map