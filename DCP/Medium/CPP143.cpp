void create_partition(){
    int n ;
    cin >> n ;
    int arr[n];
    for( int i = 0 ; i < n ; i ++ ){
        cin >> arr[i];
    }
    int pivot;
    cin >> pivot;
    int low = 0 , mid = 0 , high = n-1;
    while( mid <= high ){
        if( arr[mid] < pivot ){
            swap( arr[low++] , arr[mid++] );

        }else if( arr[mid] > pivot ){
            swap( arr[high] , arr[mid] );
            high--;
        }else{
            mid++;
        }
    }
    for( int i = 0 ; i < n ; i++ ){
        cout << arr[i] << " ";
    }
}
