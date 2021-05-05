class Solution {
public:
    int waysToMakeFair(vector<int>& nums) {
        int n = nums.size();
        if( n == 1 ) return 1;
        vector even_sum_arr(n,0),odd_sum_arr(n,0);
        even_sum_arr[0] = nums[0];
        for(int i = 1;i<n;i++){
            if(i%2 == 0){
                even_sum_arr[i] = even_sum_arr[i-1] + nums[i];
                odd_sum_arr[i] = odd_sum_arr[i-1];
            }
            else{
                even_sum_arr[i] = even_sum_arr[i-1];
                odd_sum_arr[i] = odd_sum_arr[i-1] + nums[i];
            }
        }
        int count = 0;
        for(int i = 0 ; i < n ; i++){
            int evenSum = 0 , oddSum = 0 ;
            evenSum = (i>0 ? even_sum_arr[i-1]:0) + odd_sum_arr[n-1] - odd_sum_arr[i];
            oddSum = (i>0 ? odd_sum_arr[i-1]:0) + even_sum_arr[n-1] - even_sum_arr[i];
            if( oddSum == evenSum ) count++;
        }
        return count;
    }
};
