function minPyramidCost(stones){
    if(stones.length === 0){
        return 0;
    }
    let bestCost = Infinity;
    for( let i = 0; i < stones.length; i++){
        let maxHeight= Infinity;
        for (let j = 0; j< stones.length; j++){
            maxHeight = Math.min(maxHeight, stones[j] + Math.abs(j-i));
        }
        
        let costForI = 0; 
        for (let j = 0; j < stones.length; j++){
            let target = Math.max(0, maxHeight - Math.abs(j-i));
            costForI += stones[j] - target;
        }
        bestCost = Math.min(bestCost, costForI);
    }
    return bestCost;
}