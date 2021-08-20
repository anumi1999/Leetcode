void max_sum_so_far(){
    int max_so_far = INT_MIN;
    int curr_sum = 0;
    int n;
    cin >> n;
    int arr[n];
    for( int i = 0 ; i < n ; i++ ){
        cin >> arr[i];
    }
    for( int i = 0 ; i < n ; i++ ){
        curr_sum += arr[i];
        if(max_so_far < curr_sum )
            max_so_far = curr_sum;
        if( curr_sum < 0 )
            curr_sum = 0;
    }
    cout << max_so_far;
}
