class Solution {
public:
    vector<int> countBits(int num) {
        vector<int> arr(num+1, 0);
        if( num == 0) return {0};
        arr[0] = 0 ;
        arr[1] = 1;
        for( int i = 2 ; i <= num ; i++ ){
            arr[i] = arr[i/2] + i%2;
        }
        return arr;
    }
};
