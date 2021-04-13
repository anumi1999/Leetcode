class Solution {
public:
    int minCostClimbingStairs(vector<int>& cost) {
        int f1 = cost[1] , f2 = cost[0]; 
        for( int i = 2 ; i < cost.size() ; i++){
            int f0 = cost[i] + min(f1 , f2);
            f2 = f1;
            f1 = f0;
        }
        return min(f1 , f2);
    }
};
