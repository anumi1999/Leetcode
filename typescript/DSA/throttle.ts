function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): (...args: Parameters<T>) => void{
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if(timer !== null){
            clearTimeout(timer);
        }
        timer = setTimeout(() => fn(...args), delayMs);
    }
}


function throttle<T extends (...args: any[]) => void>(fn: T, limitMs: number): (...args: Parameters<T>) => void{
    let inCoolDown = false;
    return (...args: Parameters<T>) => {
        if( !inCoolDown ){
            fn(...args);
            inCoolDown = true;
            setTimeout(() => {inCoolDown = false}, limitMs);
        }
    }
}

async function runWithLimit<T>(tasks:(() => Promise<T>)[], limit: number): Promise<T[]>{
    const results: T[] = new Array(tasks.length);
    let nextIndex = 0;

    async function worker(): Promise<void>{
        while(nextIndex < tasks.length){
            const currentIndex = nextIndex;
            nextIndex++;
            results[currentIndex] = await tasks[currentIndex]();
        }
    }

    const workers = Array.from({length: limit}, () => worker());
    await Promise.all(workers);
    return results;
}