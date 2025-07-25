const pluralize = require('pluralize');

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function toPlural(name: string): string {
    const lowerCased: string = name.charAt(0).toLowerCase() + name.slice(1);
    let plural: string = pluralize(lowerCased);
    
    if (plural === lowerCased) {
        plural = lowerCased + 's';
    }
    
    return plural;
}