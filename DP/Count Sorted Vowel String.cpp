class Solution {
public:
    int countVowelStrings(int n) {
        int ans = 1;
        for( int i = 0 ; i < n ; i++){
            ans = ans*(5 + i) / (i+1);
        }
        return ans;
    }
};
