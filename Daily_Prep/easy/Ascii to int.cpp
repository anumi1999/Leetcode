int solve(string s) {
    int sum = 0 ;
    int y = 0;
    for( int i = 0 ; i < s.size() ; i++){
        if( s[i] <= 59 && s[i] >= 48 ){
            int u = int(s[i]);
            y = y*10 + (u - 48);
            cout << y ;
        }
        else{
            cout << "Called " << y << " ";
            sum += y;
            y = 0;
            cout << sum << endl;
        }
    }
    sum += y;
    return sum;
}
