int solve(vector<int>& nums) {
    sort( nums.begin() , nums.end());
    int sol;
    bool flag = false;
    int i , j;
    for(  i = 0 , j = 2 ; j < nums.size() ;  ){
        if( (nums[i] + nums[j]) / 2 != nums[(i+j)/2] ){
            if( nums[i] != nums[j] && nums[i+1] == nums[j]){
                sol = nums[i];
            }else{
                cout << " Called ";
                flag = true;
                sol = nums[i+1];
            }
            break;
        }
        i = j+1;
        j = j+3;
    }
    if( !flag ) sol = nums[i];
    return sol;
}
