struct Interval{
    int start , end_time;
};
bool cmp( Interval &a , Interval &b ){
    return a.start < b.start ;
}
void Snapchat(){
    int n;
    cin >> n;
    Interval arr[n];
    for( int  i = 0 ; i < n ; i++ ){
        int x , y;
        cin >> x >> y;
        arr[i].start = x;
        arr[i].end_time = y;
    }
    sort(arr , arr+n , cmp);
    stack<Interval> s;
    vector<Interval> ans;
    s.push(arr[0]);
    for( int i = 1 ; i < n ; i++ ){
        Interval top = s.top();
        if( top.end_time < arr[i].start ){
            s.push(arr[i]);
        }else if( top.end_time < arr[i].end_time ){
            top.end_time = arr[i].end_time;
            s.pop();
            s.push(top);
        }
    }
    cout << " [ " ;
    while( !s.empty() ){
        cout << "[" << s.top().start << " , " << s.top().end_time << "] ";
        s.pop();
    }
    cout << "] ";
}
